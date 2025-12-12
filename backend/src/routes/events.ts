import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/events
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const where: { status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' } = {};
    if (status && ['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(status)) {
      where.status = status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.event.count({ where }),
    ]);

    res.json({
      events,
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

// GET /api/events/:id/import-errors - должен быть ПЕРЕД /:id, чтобы Express правильно его обрабатывал
router.get('/:id/import-errors', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.id);
    if (!eventId || isNaN(eventId)) {
      res.status(400).json({ error: 'Invalid event ID' });
      return;
    }

    console.log(`[Import Errors] Fetching errors for eventId: ${eventId}`);

    try {
      // Проверяем, существует ли модель в Prisma Client
      if (!prisma.importError) {
        console.error('[Import Errors] Prisma Client does not have importError model. Please run: npx prisma generate');
        res.status(500).json({ error: 'ImportError model not available. Please regenerate Prisma Client.' });
        return;
      }

      const errors = await prisma.importError.findMany({
        where: { eventId },
        orderBy: { createdAt: 'desc' },
      });

      console.log(`[Import Errors] Found ${errors.length} errors for eventId: ${eventId}`);

      res.json(errors.map((err: any) => {
        try {
          return {
            id: err.id,
            eventId: err.eventId,
            rowNumber: err.rowNumber,
            rowData: JSON.parse(err.rowData),
            errors: JSON.parse(err.errors),
            createdAt: err.createdAt,
            updatedAt: err.updatedAt,
          };
        } catch (parseError) {
          console.error(`[Import Errors] Error parsing error record ${err.id}:`, parseError);
          return {
            id: err.id,
            eventId: err.eventId,
            rowNumber: err.rowNumber,
            rowData: {},
            errors: ['Ошибка парсинга данных записи'],
            createdAt: err.createdAt,
            updatedAt: err.updatedAt,
          };
        }
      }));
    } catch (dbError: any) {
      console.error('[Import Errors] Database error:', dbError);
      
      // Если таблица не существует, возвращаем пустой массив
      if (dbError.code === '42P01' || dbError.message?.includes('does not exist') || dbError.message?.includes('relation') && dbError.message?.includes('does not exist')) {
        console.warn('[Import Errors] Table ImportError does not exist. Please run migration.');
        res.json([]);
        return;
      }
      
      // Если модель не найдена в Prisma
      if (dbError.message?.includes('Unknown arg') || dbError.message?.includes('does not exist')) {
        console.error('[Import Errors] Prisma model error:', dbError.message);
        res.status(500).json({ error: 'ImportError model not found. Please run: npx prisma generate' });
        return;
      }
      
      throw dbError;
    }
  } catch (error) {
    console.error('[Import Errors] Unexpected error:', error);
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/events/:id/import-errors/:errorId/import
router.post('/:id/import-errors/:errorId/import', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.id);
    const errorId = parseInt(req.params.errorId);
    
    if (!eventId || !errorId) {
      res.status(400).json({ error: 'Invalid event ID or error ID' });
      return;
    }

    const importError = await prisma.importError.findUnique({
      where: { id: errorId },
    });

    if (!importError || importError.eventId !== eventId) {
      res.status(404).json({ error: 'Import error not found' });
      return;
    }

    const rowData = JSON.parse(importError.rowData);
    const errors = JSON.parse(importError.errors);

    // Проверяем, что ошибки исправлены
    if (errors.length > 0 && !rowData.parsed?.disciplineId && !rowData.parsed?.disciplineName) {
      res.status(400).json({ error: 'Please fix errors before importing' });
      return;
    }

    // Загружаем справочники
    const [disciplines, nominations, ages, categories] = await Promise.all([
      prisma.discipline.findMany(),
      prisma.nomination.findMany(),
      prisma.age.findMany(),
      prisma.category.findMany(),
    ]);

    // Находим ID для дисциплины, номинации, возраста, категории
    let disciplineId: number | undefined;
    if (rowData.parsed?.disciplineId) {
      disciplineId = rowData.parsed.disciplineId;
    } else if (rowData.parsed?.disciplineName) {
      const discipline = disciplines.find((d: any) => d.name === rowData.parsed.disciplineName);
      if (discipline) {
        disciplineId = discipline.id;
      } else {
        res.status(400).json({ error: `Discipline "${rowData.parsed.disciplineName}" not found` });
        return;
      }
    }

    let nominationId: number | undefined;
    if (rowData.parsed?.nominationId) {
      nominationId = rowData.parsed.nominationId;
    } else if (rowData.parsed?.nominationName) {
      let nomination = nominations.find((n: any) => n.name === rowData.parsed.nominationName);
      if (!nomination) {
        nomination = await prisma.nomination.create({
          data: { name: rowData.parsed.nominationName },
        });
      }
      nominationId = nomination.id;
    }

    let ageId: number | undefined;
    if (rowData.parsed?.ageId) {
      ageId = rowData.parsed.ageId;
    } else if (rowData.parsed?.ageName) {
      const age = ages.find((a: any) => a.name === rowData.parsed.ageName);
      if (age) {
        ageId = age.id;
      } else {
        res.status(400).json({ error: `Age "${rowData.parsed.ageName}" not found` });
        return;
      }
    }

    let categoryId: number | undefined;
    if (rowData.parsed?.categoryId) {
      categoryId = rowData.parsed.categoryId;
    } else if (rowData.parsed?.categoryName) {
      const category = categories.find((c: any) => c.name === rowData.parsed.categoryName);
      if (category) {
        categoryId = category.id;
      }
    }

    if (!disciplineId || !nominationId || !ageId) {
      res.status(400).json({ error: 'Missing required fields: discipline, nomination, or age' });
      return;
    }

    // Поиск или создание коллектива
    let collective = await prisma.collective.findFirst({
      where: { name: { equals: rowData.collective, mode: 'insensitive' } },
    });

    if (!collective) {
      collective = await prisma.collective.create({
        data: {
          name: rowData.collective,
          school: rowData.school,
          contacts: rowData.contacts,
          city: rowData.city,
        },
      });
    }

    // Парсинг участников из diplomasList
    const { parseParticipants } = require('../services/registrationService');
    const participantsResult = rowData.diplomasList ? parseParticipants(rowData.diplomasList) : { participants: [], count: 0 };

    // Создание регистрации
    const registration = await prisma.registration.create({
      data: {
        userId: (req as any).user.id,
        eventId,
        collectiveId: collective.id,
        disciplineId,
        nominationId,
        ageId,
        categoryId,
        danceName: rowData.danceName || rowData.collective,
        participantsCount: rowData.participantsCount || participantsResult.count || 0,
        federationParticipantsCount: 0,
        diplomasCount: participantsResult.count,
        medalsCount: rowData.medalsCount || 0,
        diplomasList: rowData.diplomasList,
        duration: rowData.duration,
        videoUrl: rowData.videoUrl,
        blockNumber: rowData.parsed?.blockNumber,
        agreement: true,
        agreement2: true,
        status: 'APPROVED',
      },
    });

    // Добавление руководителей и тренеров
    if (rowData.leaders) {
      const leaderNames = rowData.leaders.split(',').map((n: string) => n.trim());
      for (const name of leaderNames) {
        if (name) {
          let person = await prisma.person.findFirst({
            where: { 
              fullName: { equals: name, mode: 'insensitive' },
              role: 'LEADER'
            },
          });

          if (!person) {
            person = await prisma.person.create({
              data: { fullName: name, role: 'LEADER' },
            });
          }

          await prisma.registrationLeader.upsert({
            where: {
              registrationId_personId: {
                registrationId: registration.id,
                personId: person.id,
              },
            },
            update: {},
            create: {
              registrationId: registration.id,
              personId: person.id,
            },
          });
        }
      }
    }

    if (rowData.trainers) {
      const trainerNames = rowData.trainers.split(',').map((n: string) => n.trim());
      for (const name of trainerNames) {
        if (name) {
          let person = await prisma.person.findFirst({
            where: { 
              fullName: { equals: name, mode: 'insensitive' },
              role: 'TRAINER'
            },
          });

          if (!person) {
            person = await prisma.person.create({
              data: { fullName: name, role: 'TRAINER' },
            });
          }

          await prisma.registrationTrainer.upsert({
            where: {
              registrationId_personId: {
                registrationId: registration.id,
                personId: person.id,
              },
            },
            update: {},
            create: {
              registrationId: registration.id,
              personId: person.id,
            },
          });
        }
      }
    }

    // Удаляем запись с ошибкой после успешного импорта
    await prisma.importError.delete({
      where: { id: errorId },
    });

    res.json({ success: true, registration });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// PUT /api/events/:id/import-errors/:errorId
router.put('/:id/import-errors/:errorId', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.id);
    const errorId = parseInt(req.params.errorId);
    
    if (!eventId || !errorId) {
      res.status(400).json({ error: 'Invalid event ID or error ID' });
      return;
    }

    const importError = await prisma.importError.findUnique({
      where: { id: errorId },
    });

    if (!importError || importError.eventId !== eventId) {
      res.status(404).json({ error: 'Import error not found' });
      return;
    }

    const rowData = JSON.parse(importError.rowData);
    const updatedRowData = { ...rowData, ...req.body };
    
    // Обновляем также parsed данные, если они переданы
    if (req.body.parsed) {
      updatedRowData.parsed = {
        ...rowData.parsed,
        ...req.body.parsed,
      };
    }

    await prisma.importError.update({
      where: { id: errorId },
      data: {
        rowData: JSON.stringify(updatedRowData),
      },
    });

    res.json({ success: true, rowData: updatedRowData });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// DELETE /api/events/:id/import-errors/:errorId
router.delete('/:id/import-errors/:errorId', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.id);
    const errorId = parseInt(req.params.errorId);
    
    if (!eventId || !errorId) {
      res.status(400).json({ error: 'Invalid event ID or error ID' });
      return;
    }

    const importError = await prisma.importError.findUnique({
      where: { id: errorId },
    });

    if (!importError || importError.eventId !== eventId) {
      res.status(404).json({ error: 'Import error not found' });
      return;
    }

    await prisma.importError.delete({
      where: { id: errorId },
    });

    res.json({ success: true, message: 'Import error deleted' });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/events/:id
router.get('/:id', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        eventPrices: {
          include: {
            nomination: true,
          },
        },
      },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json(event);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/events
router.post(
  '/',
  authenticateToken,
  requireRole('ADMIN'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    body('discountTiers').optional().custom((value) => {
      if (value) {
        try {
          const tiers = typeof value === 'string' ? JSON.parse(value) : value;
          if (!Array.isArray(tiers)) {
            throw new Error('discountTiers must be an array');
          }
          // Validate tier structure
          for (const tier of tiers) {
            if (typeof tier.minAmount !== 'number' || typeof tier.maxAmount !== 'number' || typeof tier.percentage !== 'number') {
              throw new Error('Invalid tier structure');
            }
          }
        } catch (e) {
          throw new Error('Invalid discountTiers format');
        }
      }
      return true;
    }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const {
        name,
        startDate,
        endDate,
        description,
        image,
        status,
        isOnline,
        paymentEnable,
        categoryEnable,
        songEnable,
        durationMax,
        durationGroupsInterval,
        durationParticipantsInterval,
        pricePerDiploma,
        pricePerMedal,
        discountTiers,
      } = req.body;

      const discountTiersString = discountTiers ? (typeof discountTiers === 'string' ? discountTiers : JSON.stringify(discountTiers)) : null;

      const event = await prisma.event.create({
        data: {
          name,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          description,
          image,
          status: status || 'DRAFT',
          isOnline: isOnline || false,
          paymentEnable: paymentEnable !== undefined ? paymentEnable : true,
          categoryEnable: categoryEnable !== undefined ? categoryEnable : true,
          songEnable: songEnable || false,
          durationMax: durationMax ? parseInt(String(durationMax), 10) : 43200,
          durationGroupsInterval: durationGroupsInterval ? parseInt(String(durationGroupsInterval), 10) : 0,
          durationParticipantsInterval: durationParticipantsInterval ? parseInt(String(durationParticipantsInterval), 10) : 0,
          pricePerDiploma: pricePerDiploma ? parseFloat(pricePerDiploma) : null,
          pricePerMedal: pricePerMedal ? parseFloat(pricePerMedal) : null,
          discountTiers: discountTiersString,
        },
      });

      await auditLog(req, 'CREATE_EVENT', {
        action: 'CREATE_EVENT',
        entityType: 'Event',
        entityId: event.id,
        newValue: event,
      });

      res.status(201).json(event);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// PUT /api/events/:id
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN'),
  [
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('startDate').optional().isISO8601().withMessage('Valid start date is required'),
    body('endDate').optional().isISO8601().withMessage('Valid end date is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const id = parseInt(req.params.id);
      const oldEvent = await prisma.event.findUnique({ where: { id } });

      if (!oldEvent) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      const updateData: any = {};
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.startDate !== undefined) updateData.startDate = new Date(req.body.startDate);
      if (req.body.endDate !== undefined) updateData.endDate = new Date(req.body.endDate);
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.image !== undefined) updateData.image = req.body.image;
      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.isOnline !== undefined) updateData.isOnline = req.body.isOnline;
      if (req.body.paymentEnable !== undefined) updateData.paymentEnable = req.body.paymentEnable;
      if (req.body.categoryEnable !== undefined) updateData.categoryEnable = req.body.categoryEnable;
      if (req.body.songEnable !== undefined) updateData.songEnable = req.body.songEnable;
      if (req.body.durationMax !== undefined) updateData.durationMax = parseInt(String(req.body.durationMax), 10);
      if (req.body.durationGroupsInterval !== undefined) updateData.durationGroupsInterval = parseInt(String(req.body.durationGroupsInterval), 10);
      if (req.body.durationParticipantsInterval !== undefined) updateData.durationParticipantsInterval = parseInt(String(req.body.durationParticipantsInterval), 10);
      if (req.body.pricePerDiploma !== undefined) updateData.pricePerDiploma = req.body.pricePerDiploma ? parseFloat(req.body.pricePerDiploma) : null;
      if (req.body.pricePerMedal !== undefined) updateData.pricePerMedal = req.body.pricePerMedal ? parseFloat(req.body.pricePerMedal) : null;
      if (req.body.discountTiers !== undefined) {
        updateData.discountTiers = req.body.discountTiers
          ? (typeof req.body.discountTiers === 'string' ? req.body.discountTiers : JSON.stringify(req.body.discountTiers))
          : null;
      }

      const event = await prisma.event.update({
        where: { id },
        data: updateData,
      });

      await auditLog(req, 'UPDATE_EVENT', {
        action: 'UPDATE_EVENT',
        entityType: 'Event',
        entityId: event.id,
        oldValue: oldEvent,
        newValue: event,
      });

      res.json(event);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// POST /api/events/:id/duplicate
router.post('/:id/duplicate', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Name is required for duplicated event' });
      return;
    }

    const originalEvent = await prisma.event.findUnique({
      where: { id },
      include: { eventPrices: true },
    });

    if (!originalEvent) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Create new event
    const newEvent = await prisma.event.create({
      data: {
        name,
        startDate: originalEvent.startDate,
        endDate: originalEvent.endDate,
        description: originalEvent.description,
        image: originalEvent.image,
        status: 'DRAFT',
        isOnline: originalEvent.isOnline,
        paymentEnable: originalEvent.paymentEnable,
        categoryEnable: originalEvent.categoryEnable,
        songEnable: originalEvent.songEnable,
        durationMax: originalEvent.durationMax,
        durationGroupsInterval: originalEvent.durationGroupsInterval,
        durationParticipantsInterval: originalEvent.durationParticipantsInterval,
        pricePerDiploma: originalEvent.pricePerDiploma,
        pricePerMedal: originalEvent.pricePerMedal,
        discountTiers: originalEvent.discountTiers,
      },
    });

    // Copy event prices
    if (originalEvent.eventPrices.length > 0) {
      await prisma.eventPrice.createMany({
        data: originalEvent.eventPrices.map((price: any) => ({
          eventId: newEvent.id,
          nominationId: price.nominationId,
          pricePerParticipant: price.pricePerParticipant,
          pricePerFederationParticipant: price.pricePerFederationParticipant,
        })),
      });
    }

    await auditLog(req, 'DUPLICATE_EVENT', {
      action: 'DUPLICATE_EVENT',
      entityType: 'Event',
      entityId: newEvent.id,
      newValue: { originalEventId: id, newEventId: newEvent.id },
    });

    res.status(201).json(newEvent);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// DELETE /api/events/:id/registrations
router.delete('/:id/registrations', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        registrations: {
          include: {
            accountingEntries: true,
            payments: true,
          },
        },
      },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Delete related data
    const registrationIds = event.registrations.map((r: any) => r.id);

    // Delete accounting entries and payments will be cascade deleted
    await prisma.accountingEntry.deleteMany({
      where: { registrationId: { in: registrationIds } },
    });

    await prisma.payment.deleteMany({
      where: { registrationId: { in: registrationIds } },
    });

    await prisma.registration.deleteMany({
      where: { eventId: id },
    });

    await auditLog(req, 'DELETE_EVENT_REGISTRATIONS', {
      action: 'DELETE_EVENT_REGISTRATIONS',
      entityType: 'Event',
      entityId: id,
      newValue: { deletedCount: event.registrations.length },
    });

    res.json({
      message: 'All registrations deleted',
      deleted: {
        registrations: event.registrations.length,
        payments: event.registrations.reduce((sum: number, r: any) => sum + r.payments.length, 0),
        accountingEntries: event.registrations.reduce((sum: number, r: any) => sum + r.accountingEntries.length, 0),
      },
    });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// DELETE /api/events/:id
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        registrations: true,
      },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    if (event.registrations.length > 0) {
      res.status(400).json({
        error: 'Cannot delete event with existing registrations',
        registrationsCount: event.registrations.length,
      });
      return;
    }

    await prisma.event.delete({
      where: { id },
    });

    await auditLog(req, 'DELETE_EVENT', {
      action: 'DELETE_EVENT',
      entityType: 'Event',
      entityId: id,
      oldValue: event,
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

export default router;


