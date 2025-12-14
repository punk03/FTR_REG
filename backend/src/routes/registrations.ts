import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { cacheService } from '../services/cacheService';
import {
  parseParticipants,
  validateNominationParticipants,
  upsertCollective,
  upsertPerson,
  getNextRegistrationNumber,
} from '../services/registrationService';
import { createRegistrationHistory, getChangedFields } from '../services/registrationHistoryService';
import { emailService } from '../services/emailService';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/registrations
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = req.query.eventId ? parseInt(req.query.eventId as string) : undefined;
    const search = req.query.search as string | undefined;
    const paymentStatus = req.query.paymentStatus as string | undefined;
    const registrationStatus = req.query.status as string | undefined;
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (eventId) {
      where.eventId = eventId;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (registrationStatus) {
      where.status = registrationStatus;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(dateTo);
        endDate.setDate(endDate.getDate() + 1);
        where.createdAt.lt = endDate;
      }
    }

    if (search) {
      where.OR = [
        { collective: { name: { contains: search, mode: 'insensitive' } } },
        { danceName: { contains: search, mode: 'insensitive' } },
        { discipline: { name: { contains: search, mode: 'insensitive' } } },
        { leaders: { some: { person: { fullName: { contains: search, mode: 'insensitive' } } } } },
        { trainers: { some: { person: { fullName: { contains: search, mode: 'insensitive' } } } } },
      ];
    }

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: {
          collective: true,
          discipline: true,
          nomination: true,
          age: true,
          category: true,
          leaders: { include: { person: true } },
          trainers: { include: { person: true } },
        },
        orderBy: [
          { collective: { name: 'asc' } },
          { createdAt: 'desc' },
        ],
        skip,
        take: limit,
      }),
      prisma.registration.count({ where }),
    ]);

    res.json({
      registrations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/registrations/:id
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        collective: true,
        discipline: true,
        nomination: true,
        age: true,
        category: true,
        leaders: { include: { person: true } },
        trainers: { include: { person: true } },
        participants: { include: { participant: true } },
        accountingEntries: {
          where: { deletedAt: null },
        },
        payments: true,
      },
    });

    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    res.json(registration);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/registrations
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN', 'REGISTRATOR'),
  [
    body('eventId').isInt().withMessage('Valid eventId is required'),
    body('collectiveName').notEmpty().withMessage('collectiveName is required'),
    body('disciplineId').isInt().withMessage('Valid disciplineId is required'),
    body('nominationId').isInt().withMessage('Valid nominationId is required'),
    body('ageId').isInt().withMessage('Valid ageId is required'),
    body('duration').optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const {
        eventId,
        collectiveName,
        accessory,
        leaders,
        trainers,
        disciplineId,
        nominationId,
        ageId,
        categoryId,
        danceName,
        duration,
        participantsCount,
        federationParticipantsCount,
        participantIds,
        videoUrl,
        songUrl,
        agreement,
        agreement2,
        status,
        resume,
        diplomasList,
        diplomasCount,
        medalsCount,
      } = req.body;

      // Get nomination for validation
      const nomination = await prisma.nomination.findUnique({
        where: { id: nominationId },
      });

      if (!nomination) {
        res.status(400).json({ error: 'Nomination not found' });
        return;
      }

      // Validate participant count
      const nominationNameLower = nomination.name.toLowerCase();
      let finalParticipantsCount =
        typeof participantsCount === 'number' && participantsCount > 0 ? participantsCount : 0;

      // Для соло по умолчанию считаем 1 участника, если явно не передано другое положительное значение
      if (finalParticipantsCount === 0 && nominationNameLower.includes('соло')) {
        finalParticipantsCount = 1;
      }

      const validation = validateNominationParticipants(nomination.name, finalParticipantsCount, participantIds);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }

      // Upsert collective
      const collective = await upsertCollective(collectiveName, accessory);

      // Get next registration number
      const number = await getNextRegistrationNumber(eventId);

      // Create registration
      const registration = await prisma.registration.create({
        data: {
          userId: (req as any).user.id,
          eventId,
          collectiveId: collective.id,
          disciplineId,
          nominationId,
          ageId,
          categoryId,
          danceName,
          duration,
          participantsCount: finalParticipantsCount,
          federationParticipantsCount: federationParticipantsCount || 0,
          number,
          videoUrl,
          songUrl,
          agreement: agreement || false,
          agreement2: agreement2 || false,
          notes: req.body.notes || undefined,
          status: status || 'PENDING',
          resume: status === 'REJECTED' ? resume : undefined,
        },
      });

      // Create leaders
      if (leaders) {
        const leaderNames = typeof leaders === 'string' ? leaders.split(',').map((s: string) => s.trim()) : leaders;
        for (const leaderName of leaderNames) {
          if (leaderName) {
            const person = await upsertPerson(leaderName, 'LEADER');
            await prisma.registrationLeader.create({
              data: {
                registrationId: registration.id,
                personId: person.id,
              },
            });
          }
        }
      }

      // Create trainers
      if (trainers) {
        const trainerNames = typeof trainers === 'string' ? trainers.split(',').map((s: string) => s.trim()) : trainers;
        for (const trainerName of trainerNames) {
          if (trainerName) {
            const person = await upsertPerson(trainerName, 'TRAINER');
            await prisma.registrationTrainer.create({
              data: {
                registrationId: registration.id,
                personId: person.id,
              },
            });
          }
        }
      }

      // Create participants
      if (participantIds && Array.isArray(participantIds)) {
        for (const participantId of participantIds) {
          await prisma.registrationParticipant.create({
            data: {
              registrationId: registration.id,
              participantId,
            },
          });
        }
      }

      const created = await prisma.registration.findUnique({
        where: { id: registration.id },
        include: {
          collective: true,
          discipline: true,
          nomination: true,
          age: true,
          category: true,
          leaders: { include: { person: true } },
          trainers: { include: { person: true } },
        },
      });

      // Create history entry
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      await createRegistrationHistory({
        registrationId: registration.id,
        userId: (req as any).user.id,
        action: 'CREATE',
        newValues: created as unknown as Record<string, unknown>,
        ipAddress: typeof ipAddress === 'string' ? ipAddress : undefined,
      });

      // Invalidate statistics cache for this event
      await cacheService.del(`statistics:${eventId}`);

      // Send email notification (non-blocking)
      if (emailService.isEnabled()) {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (user && event) {
          emailService.sendRegistrationCreatedNotification(user.email, {
            id: registration.id,
            number: registration.number,
            collectiveName: collective.name,
            eventName: event.name,
            danceName: registration.danceName || undefined,
          }).catch((error) => {
            console.error('Error sending registration created email:', error);
          });
        }
      }

      res.status(201).json(created);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// PATCH /api/registrations/:id
router.patch(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'REGISTRATOR'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const registration = await prisma.registration.findUnique({
        where: { id },
      });

      if (!registration) {
        res.status(404).json({ error: 'Registration not found' });
        return;
      }

      // Check if registration has payments - limit editable fields
      const hasPayments = registration.performancePaid || registration.diplomasAndMedalsPaid;
      // Check if registration has payments - limit editable fields
      // const allowedFields = hasPayments
      //   ? ['participantsCount', 'federationParticipantsCount', 'medalsCount', 'diplomasCount', 'diplomasList', 'nominationId']
      //   : undefined;

      const updateData: any = {};
      if (req.body.participantsCount !== undefined) updateData.participantsCount = req.body.participantsCount;
      if (req.body.federationParticipantsCount !== undefined) updateData.federationParticipantsCount = req.body.federationParticipantsCount;
      if (req.body.medalsCount !== undefined) updateData.medalsCount = req.body.medalsCount;
      if (req.body.diplomasCount !== undefined) updateData.diplomasCount = req.body.diplomasCount;
      if (req.body.diplomasList !== undefined) {
        updateData.diplomasList = req.body.diplomasList;
        // Auto-calculate diplomasCount from list
        if (req.body.diplomasList) {
          const parsed = parseParticipants(req.body.diplomasList);
          updateData.diplomasCount = parsed.count;
        }
      }
      if (req.body.nominationId !== undefined) updateData.nominationId = req.body.nominationId;
      if (req.body.blockNumber !== undefined) {
        updateData.blockNumber = req.body.blockNumber === null || req.body.blockNumber === '' ? null : parseInt(String(req.body.blockNumber));
      }
      if (req.body.diplomasDataDeletedAt !== undefined) updateData.diplomasDataDeletedAt = req.body.diplomasDataDeletedAt ? new Date() : null;
      if (req.body.notes !== undefined) updateData.notes = req.body.notes;

      // Only allow other fields if no payments
      if (!hasPayments) {
        if (req.body.danceName !== undefined) updateData.danceName = req.body.danceName;
        if (req.body.duration !== undefined) updateData.duration = req.body.duration;
        if (req.body.status !== undefined) updateData.status = req.body.status;
      }

      // Get old values for history
      const oldRegistration = { ...registration };

      const updated = await prisma.registration.update({
        where: { id },
        data: updateData,
        include: {
          collective: true,
          discipline: true,
          nomination: true,
          age: true,
          category: true,
        },
      });

      // Create history entry if there were changes
      if (Object.keys(updateData).length > 0) {
        const { changedFields, oldValues, newValues } = getChangedFields(
          oldRegistration as unknown as Record<string, unknown>,
          updated as unknown as Record<string, unknown>
        );

        if (changedFields.length > 0) {
          const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
          await createRegistrationHistory({
            registrationId: id,
            userId: (req as any).user.id,
            action: 'UPDATE',
            changedFields,
            oldValues,
            newValues,
            ipAddress: typeof ipAddress === 'string' ? ipAddress : undefined,
          });

          // Send email notification if status changed (non-blocking)
          if (changedFields.includes('status') && emailService.isEnabled()) {
            const registrationUser = await prisma.user.findUnique({ where: { id: registration.userId } });
            const collective = await prisma.collective.findUnique({ where: { id: registration.collectiveId } });
            if (registrationUser && collective) {
              emailService.sendRegistrationStatusChangedNotification(registrationUser.email, {
                id: registration.id,
                number: registration.number,
                collectiveName: collective.name,
                oldStatus: oldRegistration.status,
                newStatus: updated.status,
              }).catch((error) => {
                console.error('Error sending registration status changed email:', error);
              });
            }
          }
        }
      }

      res.json(updated);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// DELETE /api/registrations/:id
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const registration = await prisma.registration.findUnique({
      where: { id },
      select: { eventId: true },
    });

    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    // Create history entry before deletion
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    await createRegistrationHistory({
      registrationId: id,
      userId: (req as any).user.id,
      action: 'DELETE',
      ipAddress: typeof ipAddress === 'string' ? ipAddress : undefined,
    });

    await prisma.registration.delete({
      where: { id },
    });

    // Invalidate statistics cache for this event
    await cacheService.del(`statistics:${registration.eventId}`);

    res.json({ message: 'Registration deleted successfully' });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/registrations/:id/calculate-price
router.get('/:id/calculate-price', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        event: true,
        nomination: true,
      },
    });

    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    // Override with query params if provided
    const participantsCount = req.query.participantsCount
      ? parseInt(req.query.participantsCount as string)
      : registration.participantsCount;
    const federationParticipantsCount = req.query.federationParticipantsCount
      ? parseInt(req.query.federationParticipantsCount as string)
      : registration.federationParticipantsCount;
    const diplomasCount = req.query.diplomasCount
      ? parseInt(req.query.diplomasCount as string)
      : registration.diplomasCount;
    const medalsCount = req.query.medalsCount
      ? parseInt(req.query.medalsCount as string)
      : registration.medalsCount;
    const nominationId = req.query.nominationId
      ? parseInt(req.query.nominationId as string)
      : registration.nominationId;

    // Get event price
    const eventPrice = await prisma.eventPrice.findUnique({
      where: {
        eventId_nominationId: {
          eventId: registration.eventId,
          nominationId: nominationId,
        },
      },
    });

    if (!eventPrice) {
      res.status(400).json({ error: 'Event price not found for this nomination' });
      return;
    }

    // Calculate performance price
    const regularCount = Math.max(0, participantsCount - federationParticipantsCount);
    const regularPrice = Number(eventPrice.pricePerParticipant) * regularCount;
    const federationPrice =
      Number(eventPrice.pricePerFederationParticipant || eventPrice.pricePerParticipant) * federationParticipantsCount;
    const performancePrice = regularPrice + federationPrice;

    // Calculate diplomas and medals price
    const diplomasPrice = registration.event.pricePerDiploma ? Number(registration.event.pricePerDiploma) * diplomasCount : 0;
    const medalsPrice = registration.event.pricePerMedal ? Number(registration.event.pricePerMedal) * medalsCount : 0;
    const diplomasAndMedalsPrice = diplomasPrice + medalsPrice;

    const total = performancePrice + diplomasAndMedalsPrice;

    res.json({
      performancePrice: Math.round(performancePrice),
      diplomasAndMedalsPrice: Math.round(diplomasAndMedalsPrice),
      total: Math.round(total),
      details: {
        regularParticipants: regularCount,
        regularPrice: Math.round(regularPrice),
        federationParticipants: federationParticipantsCount,
        federationPrice: Math.round(federationPrice),
        diplomasCount,
        diplomasPrice: Math.round(diplomasPrice),
        medalsCount,
        medalsPrice: Math.round(medalsPrice),
      },
    });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/registrations/count-in-direction
router.post(
  '/count-in-direction',
  authenticateToken,
  [
    body('eventId').isInt().withMessage('Valid eventId is required'),
    body('disciplineId').isInt().withMessage('Valid disciplineId is required'),
    body('nominationId').isInt().withMessage('Valid nominationId is required'),
    body('ageId').isInt().withMessage('Valid ageId is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { eventId, disciplineId, nominationId, ageId, categoryId } = req.body;

      const where: any = {
        eventId,
        disciplineId,
        nominationId,
        ageId,
        status: 'APPROVED',
      };

      if (categoryId) {
        where.categoryId = categoryId;
      }

      const count = await prisma.registration.count({ where });

      res.json({ count });
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// POST /api/registrations/draft - Сохранение черновика
router.post(
  '/draft',
  authenticateToken,
  [body('formData').isString().withMessage('formData is required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const draftId = req.body.draftId ? parseInt(req.body.draftId) : null;
      const { formData, eventId } = req.body;
      const userId = (req as any).user.id;

      let draft;

      if (draftId) {
        // Обновление существующего черновика
        const existingDraft = await prisma.draftRegistration.findUnique({
          where: { id: draftId },
        });

        if (!existingDraft) {
          res.status(404).json({ error: 'Draft not found' });
          return;
        }

        if (existingDraft.userId !== userId) {
          res.status(403).json({ error: 'Access denied' });
          return;
        }

        draft = await prisma.draftRegistration.update({
          where: { id: draftId },
          data: {
            formData,
            eventId: eventId ? parseInt(eventId) : undefined,
            updatedAt: new Date(),
          },
        });
      } else {
        // Создание нового черновика
        draft = await prisma.draftRegistration.create({
          data: {
            userId,
            eventId: eventId ? parseInt(eventId) : undefined,
            formData,
          },
        });
      }

      res.json({ success: true, draftId: draft.id });
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// GET /api/registrations/drafts - Получение черновиков пользователя
router.get('/drafts', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const drafts = await prisma.draftRegistration.findMany({
      where: {
        userId: (req as any).user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    res.json(drafts);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// DELETE /api/registrations/drafts/:id - Удаление черновика
router.delete('/drafts/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const draftId = parseInt(req.params.id);

    // Проверка что черновик принадлежит пользователю
    const draft = await prisma.draftRegistration.findUnique({
      where: { id: draftId },
    });

    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    if (draft.userId !== (req as any).user.id) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await prisma.draftRegistration.delete({
      where: { id: draftId },
    });

    res.json({ success: true });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/registrations/:id/history - Получение истории изменений регистрации
router.get('/:id/history', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    // Check if registration exists
    const registration = await prisma.registration.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    const history = await prisma.registrationHistory.findMany({
      where: { registrationId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Parse JSON fields
    const formattedHistory = history.map((entry: any) => ({
      ...entry,
      changedFields: entry.changedFields ? JSON.parse(entry.changedFields) : null,
      oldValues: entry.oldValues ? JSON.parse(entry.oldValues) : null,
      newValues: entry.newValues ? JSON.parse(entry.newValues) : null,
    }));

    res.json(formattedHistory);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/registrations/templates - Получение шаблонов пользователя
router.get('/templates', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const templates = await prisma.registrationTemplate.findMany({
      where: {
        userId: (req as any).user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    res.json(templates);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/registrations/templates - Создание шаблона
router.post(
  '/templates',
  authenticateToken,
  requireRole('ADMIN', 'REGISTRATOR'),
  [body('name').notEmpty().withMessage('Template name is required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { name, ...formData } = req.body;

      const template = await prisma.registrationTemplate.create({
        data: {
          userId: (req as any).user.id,
          name,
          formData: JSON.stringify(formData),
        },
      });

      res.status(201).json(template);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// PUT /api/registrations/templates/:id - Обновление шаблона
router.put(
  '/templates/:id',
  authenticateToken,
  requireRole('ADMIN', 'REGISTRATOR'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      const template = await prisma.registrationTemplate.findUnique({
        where: { id },
      });

      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      if (template.userId !== (req as any).user.id && (req as any).user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const { name, ...formData } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (Object.keys(formData).length > 0) {
        updateData.formData = JSON.stringify(formData);
      }

      const updated = await prisma.registrationTemplate.update({
        where: { id },
        data: updateData,
      });

      res.json(updated);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// DELETE /api/registrations/templates/:id - Удаление шаблона
router.delete('/templates/:id', authenticateToken, requireRole('ADMIN', 'REGISTRATOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const template = await prisma.registrationTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      res.status(404).json({ error: 'Template not found' });
      return;
    }

    if (template.userId !== (req as any).user.id && (req as any).user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    await prisma.registrationTemplate.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

export default router;

