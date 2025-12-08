import express, { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { cacheService } from '../services/cacheService';
import { recalculateRegistrationPaymentStatus } from '../services/paymentService';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/accounting
router.get('/', authenticateToken, requireRole('ADMIN', 'ACCOUNTANT'), async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.query.eventId as string);
    const includeDeleted = req.query.includeDeleted === 'true';
    const deletedOnly = req.query.deletedOnly === 'true';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    if (!eventId) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }

    const where: any = {
      OR: [
        { registration: { eventId } },
        { eventId: eventId, registrationId: null, collectiveId: null }, // Manual payments
      ],
    };

    if (deletedOnly) {
      where.deletedAt = { not: null };
    } else if (!includeDeleted) {
      where.deletedAt = null;
    }

    const [entries, total] = await Promise.all([
      prisma.accountingEntry.findMany({
        where,
        include: {
          registration: {
            include: {
              collective: true,
              discipline: true,
              nomination: true,
              age: true,
            },
          },
          collective: true,
          event: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.accountingEntry.count({ where }),
    ]).catch((error) => {
      console.error('Error fetching accounting entries:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    });

    // Group by paymentGroupId, but only for payments with registrationId (not manual payments)
    // Manual payments (without registrationId) should always be ungrouped
    const grouped: Record<string, typeof entries> = {};
    const ungrouped: typeof entries = [];

    for (const entry of entries) {
      // Only group payments that have registrationId (i.e., are linked to registrations)
      // Manual payments (without registrationId) should be displayed as individual entries
      if (entry.paymentGroupId && entry.registrationId) {
        if (!grouped[entry.paymentGroupId]) {
          grouped[entry.paymentGroupId] = [];
        }
        grouped[entry.paymentGroupId].push(entry);
      } else {
        ungrouped.push(entry);
      }
    }

    // Calculate summary
    const performanceEntries = entries.filter((e: any) => e.paidFor === 'PERFORMANCE' && !e.deletedAt);
    const diplomasEntries = entries.filter((e: any) => e.paidFor === 'DIPLOMAS_MEDALS' && !e.deletedAt);

    const summary = {
      performance: {
        cash: performanceEntries.filter((e: any) => e.method === 'CASH').reduce((sum: number, e: any) => sum + Number(e.amount), 0),
        card: performanceEntries.filter((e: any) => e.method === 'CARD').reduce((sum: number, e: any) => sum + Number(e.amount), 0),
        transfer: performanceEntries.filter((e: any) => e.method === 'TRANSFER').reduce((sum: number, e: any) => sum + Number(e.amount), 0),
        total: performanceEntries.reduce((sum: number, e: any) => sum + Number(e.amount), 0),
      },
      diplomasAndMedals: {
        cash: diplomasEntries.filter((e: any) => e.method === 'CASH').reduce((sum: number, e: any) => sum + Number(e.amount), 0),
        card: diplomasEntries.filter((e: any) => e.method === 'CARD').reduce((sum: number, e: any) => sum + Number(e.amount), 0),
        transfer: diplomasEntries.filter((e: any) => e.method === 'TRANSFER').reduce((sum: number, e: any) => sum + Number(e.amount), 0),
        total: diplomasEntries.reduce((sum: number, e: any) => sum + Number(e.amount), 0),
      },
      totalByMethod: {
        cash: entries.filter((e: any) => !e.deletedAt && e.method === 'CASH').reduce((sum: number, e: any) => sum + Number(e.amount), 0),
        card: entries.filter((e: any) => !e.deletedAt && e.method === 'CARD').reduce((sum: number, e: any) => sum + Number(e.amount), 0),
        transfer: entries.filter((e: any) => !e.deletedAt && e.method === 'TRANSFER').reduce((sum: number, e: any) => sum + Number(e.amount), 0),
      },
      grandTotal: entries.filter((e: any) => !e.deletedAt).reduce((sum: number, e: any) => sum + Number(e.amount), 0),
      totalDiscount: performanceEntries.reduce((sum: number, e: any) => sum + Number(e.discountAmount), 0),
    };

    res.json({
      entries: Object.values(grouped).concat(ungrouped.length > 0 ? [ungrouped] : []),
      grouped,
      ungrouped,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('GET /api/accounting error:', error);
    console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/accounting - Create manual payment entry
router.post(
  '/',
  (req: Request, _res: Response, next: NextFunction) => {
    console.log('[POST /api/accounting] Request received:', {
      method: req.method,
      path: req.path,
      body: req.body,
    });
    next();
  },
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNTANT'),
  [
    body('description').notEmpty().withMessage('Description is required'),
    body('paidFor').isIn(['PERFORMANCE', 'DIPLOMAS_MEDALS']).withMessage('Valid paidFor is required'),
    body('eventId').custom((value) => {
      const num = parseInt(value);
      if (isNaN(num) || num <= 0) {
        throw new Error('Valid eventId is required');
      }
      return true;
    }),
    body('cash').optional().custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Cash must be a positive number');
      }
      return true;
    }),
    body('card').optional().custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Card must be a positive number');
      }
      return true;
    }),
    body('transfer').optional().custom((value) => {
      if (value === undefined || value === null || value === '') return true;
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new Error('Transfer must be a positive number');
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

      const { description, paidFor, eventId: eventIdRaw, cash, card, transfer } = req.body;

      // Parse eventId to ensure it's a number
      const parsedEventId = parseInt(eventIdRaw);
      if (isNaN(parsedEventId) || parsedEventId <= 0) {
        res.status(400).json({ error: 'Valid eventId is required' });
        return;
      }

      // At least one payment method must have amount > 0
      const totalAmount = (parseFloat(cash || 0) + parseFloat(card || 0) + parseFloat(transfer || 0));
      if (totalAmount === 0) {
        res.status(400).json({ error: 'At least one payment method must have amount > 0' });
        return;
      }

      // Manual payments should NOT have paymentGroupId - they are individual entries
      // Each payment method creates a separate independent entry
      const entries = [];

      // Create entry for cash payment
      if (cash && parseFloat(cash) > 0) {
        entries.push({
          registrationId: null,
          collectiveId: null,
          eventId: parsedEventId,
          amount: parseFloat(cash),
          discountAmount: 0,
          discountPercent: 0,
          method: 'CASH' as const,
          paidFor: paidFor as 'PERFORMANCE' | 'DIPLOMAS_MEDALS',
          paymentGroupId: null,
          paymentGroupName: null,
          description,
        });
      }

      // Create entry for card payment
      if (card && parseFloat(card) > 0) {
        entries.push({
          registrationId: null,
          collectiveId: null,
          eventId: parsedEventId,
          amount: parseFloat(card),
          discountAmount: 0,
          discountPercent: 0,
          method: 'CARD' as const,
          paidFor: paidFor as 'PERFORMANCE' | 'DIPLOMAS_MEDALS',
          paymentGroupId: null,
          paymentGroupName: null,
          description,
        });
      }

      // Create entry for transfer payment
      if (transfer && parseFloat(transfer) > 0) {
        entries.push({
          registrationId: null,
          collectiveId: null,
          eventId: parsedEventId,
          amount: parseFloat(transfer),
          discountAmount: 0,
          discountPercent: 0,
          method: 'TRANSFER' as const,
          paidFor: paidFor as 'PERFORMANCE' | 'DIPLOMAS_MEDALS',
          paymentGroupId: null,
          paymentGroupName: null,
          description,
        });
      }

      // Create all entries
      const createdEntries = await prisma.accountingEntry.createMany({
        data: entries,
      });

      // Invalidate statistics cache for this event
      await cacheService.del(`statistics:${parsedEventId}`);

      res.json({
        message: 'Manual payment entries created successfully',
        entries: createdEntries,
        totalAmount,
      });
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// PUT /api/accounting/:id
router.put(
  '/:id',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNTANT'),
  [
    body('amount').optional().isFloat({ min: 0 }),
    body('method').optional().isIn(['CASH', 'CARD', 'TRANSFER']),
    body('paidFor').optional().isIn(['PERFORMANCE', 'DIPLOMAS_MEDALS']),
    body('description').optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const id = parseInt(req.params.id);
      const entry = await prisma.accountingEntry.findUnique({
        where: { id },
        include: { registration: { include: { event: true } } },
      });

      if (!entry) {
        res.status(404).json({ error: 'Accounting entry not found' });
        return;
      }

      const updateData: any = {};
      if (req.body.amount !== undefined) updateData.amount = parseFloat(req.body.amount);
      if (req.body.method !== undefined) updateData.method = req.body.method;
      if (req.body.paidFor !== undefined) {
        updateData.paidFor = req.body.paidFor;
        // Clear discount if changing to DIPLOMAS_MEDALS
        if (req.body.paidFor === 'DIPLOMAS_MEDALS') {
          updateData.discountAmount = 0;
          updateData.discountPercent = 0;
        }
      }
      // Allow editing description for manual payments (entries without registrationId)
      if (req.body.description !== undefined && !entry.registrationId) {
        updateData.description = req.body.description;
        // Also update paymentGroupName if it matches the old description
        if (entry.paymentGroupName === entry.description) {
          updateData.paymentGroupName = req.body.description;
        }
      }
      if (req.body.diplomasList !== undefined && entry.registrationId) {
        await prisma.registration.update({
          where: { id: entry.registrationId },
          data: { diplomasList: req.body.diplomasList },
        });
      }
      if (req.body.medalsCount !== undefined && entry.registrationId) {
        await prisma.registration.update({
          where: { id: entry.registrationId },
          data: { medalsCount: req.body.medalsCount },
        });
      }
      if (req.body.diplomasCount !== undefined && entry.registrationId) {
        await prisma.registration.update({
          where: { id: entry.registrationId },
          data: { diplomasCount: req.body.diplomasCount },
        });
      }

      // Handle discount (only for PERFORMANCE)
      if (req.body.discountPercent !== undefined && entry.paidFor === 'PERFORMANCE') {
        const originalAmount = Number(entry.amount) + Number(entry.discountAmount);
        const discountPercent = parseFloat(req.body.discountPercent);
        const discountAmount = (originalAmount * discountPercent) / 100;
        updateData.discountAmount = discountAmount;
        updateData.discountPercent = discountPercent;
        updateData.amount = originalAmount - discountAmount;
      }

      const updated = await prisma.accountingEntry.update({
        where: { id },
        data: updateData,
        include: {
          registration: {
            include: {
              collective: true,
              discipline: true,
              nomination: true,
              age: true,
            },
          },
          collective: true,
        },
      });

      if (entry.registrationId) {
        await recalculateRegistrationPaymentStatus(entry.registrationId);
      }

      res.json(updated);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// DELETE /api/accounting/:id
router.delete('/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const entry = await prisma.accountingEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      res.status(404).json({ error: 'Accounting entry not found' });
      return;
    }

    await prisma.accountingEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (entry.registrationId) {
      await recalculateRegistrationPaymentStatus(entry.registrationId);
    }

    // Invalidate statistics cache for this event
    if (entry.registrationId) {
      const registration = await prisma.registration.findUnique({
        where: { id: entry.registrationId },
        select: { eventId: true },
      });
      if (registration) {
        await cacheService.del(`statistics:${registration.eventId}`);
      }
    } else if (entry.eventId) {
      // For manual payments, use eventId directly
      await cacheService.del(`statistics:${entry.eventId}`);
    }

    res.json({ message: 'Accounting entry deleted successfully' });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/accounting/:id/restore
router.post('/:id/restore', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const entry = await prisma.accountingEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      res.status(404).json({ error: 'Accounting entry not found' });
      return;
    }

    const restored = await prisma.accountingEntry.update({
      where: { id },
      data: { deletedAt: null },
    });

    // Restore diplomas data if needed
    if (entry.paidFor === 'DIPLOMAS_MEDALS') {
      // Data restoration logic if needed
    }

    if (entry.registrationId) {
      await recalculateRegistrationPaymentStatus(entry.registrationId);
    }

    // Invalidate statistics cache for this event
    if (entry.registrationId) {
      const registration = await prisma.registration.findUnique({
        where: { id: entry.registrationId },
        select: { eventId: true },
      });
      if (registration) {
        await cacheService.del(`statistics:${registration.eventId}`);
      }
    } else if (entry.eventId) {
      // For manual payments, use eventId directly
      await cacheService.del(`statistics:${entry.eventId}`);
    }

    res.json({ message: 'Accounting entry restored successfully', entry: restored });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// PUT /api/accounting/payment-group/:paymentGroupId/name
router.put(
  '/payment-group/:paymentGroupId/name',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNTANT'), // ADMIN and ACCOUNTANT can edit group names
  [body('name').notEmpty().withMessage('Name is required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { paymentGroupId } = req.params;
      const { name } = req.body;

      const result = await prisma.accountingEntry.updateMany({
        where: { paymentGroupId },
        data: { paymentGroupName: name },
      });

      res.json({ message: 'Payment group name updated', updatedCount: result.count });
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// PUT /api/accounting/payment-group/:paymentGroupId/discount
router.put(
  '/payment-group/:paymentGroupId/discount',
  authenticateToken,
  requireRole('ADMIN', 'ACCOUNTANT'),
  [body('discountPercent').isFloat({ min: 0, max: 100 }).withMessage('Valid discountPercent (0-100) is required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { paymentGroupId } = req.params;
      const { discountPercent } = req.body;

      // Get all PERFORMANCE entries in the group
      const entries = await prisma.accountingEntry.findMany({
        where: {
          paymentGroupId,
          paidFor: 'PERFORMANCE',
          deletedAt: null,
        },
        include: { registration: { include: { event: true } } },
      });

      if (entries.length === 0) {
        res.status(404).json({ error: 'No PERFORMANCE entries found in this group' });
        return;
      }

      // Calculate original amounts and apply discount
      let totalOriginalAmount = 0;
      for (const entry of entries) {
        const original = Number(entry.amount) + Number(entry.discountAmount);
        totalOriginalAmount += original;
      }

      const totalDiscountAmount = (totalOriginalAmount * discountPercent) / 100;

      // Update entries proportionally
      const updatedEntries = [];
      for (const entry of entries) {
        const original = Number(entry.amount) + Number(entry.discountAmount);
        const proportion = original / totalOriginalAmount;
        const entryDiscountAmount = totalDiscountAmount * proportion;
        const finalAmount = original - entryDiscountAmount;

        const updated = await prisma.accountingEntry.update({
          where: { id: entry.id },
          data: {
            amount: finalAmount,
            discountAmount: entryDiscountAmount,
            discountPercent,
          },
        });

        if (entry.registrationId) {
          await recalculateRegistrationPaymentStatus(entry.registrationId);
        }
        updatedEntries.push(updated);
      }

      // Invalidate statistics cache for all affected events
      const eventIds = new Set<number>();
      for (const entry of entries) {
        if (entry.registration?.eventId) {
          eventIds.add(entry.registration.eventId);
        } else if (entry.eventId) {
          eventIds.add(entry.eventId);
        }
      }
      for (const eventId of eventIds) {
        await cacheService.del(`statistics:${eventId}`);
      }

      res.json({
        message: 'Discount applied',
        discountPercent,
        discountAmount: totalDiscountAmount,
        originalAmount: totalOriginalAmount,
        finalAmount: totalOriginalAmount - totalDiscountAmount,
        affectedEntries: updatedEntries.length,
      });
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

export default router;

