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
          durationMax: durationMax || 43200,
          durationGroupsInterval: durationGroupsInterval || 0,
          durationParticipantsInterval: durationParticipantsInterval || 0,
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
        data: originalEvent.eventPrices.map((price) => ({
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
    const registrationIds = event.registrations.map((r) => r.id);

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
        payments: event.registrations.reduce((sum, r) => sum + r.payments.length, 0),
        accountingEntries: event.registrations.reduce((sum, r) => sum + r.accountingEntries.length, 0),
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


