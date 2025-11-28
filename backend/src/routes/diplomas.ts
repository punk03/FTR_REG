import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { recalculateRegistrationPaymentStatus } from '../services/paymentService';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/diplomas
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.query.eventId as string);
    const includeDeleted = req.query.includeDeleted === 'true';
    const deletedOnly = req.query.deletedOnly === 'true';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 25;
    const skip = (page - 1) * limit;

    if (!eventId) {
      res.status(400).json({ error: 'eventId is required' });
      return;
    }

    const where: any = { eventId };
    if (deletedOnly) {
      where.diplomasDataDeletedAt = { not: null };
    } else if (!includeDeleted) {
      where.diplomasDataDeletedAt = null;
    }

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        include: {
          collective: true,
          discipline: true,
          nomination: true,
          age: true,
        },
        orderBy: { blockNumber: 'asc' },
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

// POST /api/diplomas/pay
router.post(
  '/pay',
  authenticateToken,
  requireRole('ADMIN', 'REGISTRATOR'),
  [
    body('registrationIds').isArray({ min: 1 }).withMessage('At least one registrationId is required'),
    body('paymentsByMethod').isObject().withMessage('paymentsByMethod is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { registrationIds, paymentsByMethod } = req.body;
      const cash = paymentsByMethod.cash || 0;
      const card = paymentsByMethod.card || 0;
      const transfer = paymentsByMethod.transfer || 0;
      const totalPaid = cash + card + transfer;

      const registrations = await prisma.registration.findMany({
        where: { id: { in: registrationIds } },
        include: { event: true },
      });

      let totalRequired = 0;
      for (const reg of registrations) {
        const diplomasPrice = reg.event.pricePerDiploma ? Number(reg.event.pricePerDiploma) * reg.diplomasCount : 0;
        const medalsPrice = reg.event.pricePerMedal ? Number(reg.event.pricePerMedal) * reg.medalsCount : 0;
        totalRequired += diplomasPrice + medalsPrice;
      }

      if (Math.abs(totalPaid - totalRequired) > 0.01) {
        res.status(400).json({ error: 'Payment amount mismatch', totalPaid, totalRequired });
        return;
      }

      const { v4: uuidv4 } = require('uuid');
      const paymentGroupId = registrations.length > 1 ? uuidv4() : null;

      for (const reg of registrations) {
        const diplomasPrice = reg.event.pricePerDiploma ? Number(reg.event.pricePerDiploma) * reg.diplomasCount : 0;
        const medalsPrice = reg.event.pricePerMedal ? Number(reg.event.pricePerMedal) * reg.medalsCount : 0;
        const regAmount = diplomasPrice + medalsPrice;
        const proportion = totalRequired > 0 ? regAmount / totalRequired : 0;

        const cashAmount = Math.round(cash * proportion);
        const cardAmount = Math.round(card * proportion);
        const transferAmount = regAmount - cashAmount - cardAmount;

        if (cashAmount > 0) {
          await prisma.accountingEntry.create({
            data: {
              registrationId: reg.id,
              collectiveId: reg.collectiveId,
              amount: cashAmount,
              method: 'CASH',
              paidFor: 'DIPLOMAS_MEDALS',
              paymentGroupId,
            },
          });
        }

        if (cardAmount > 0) {
          await prisma.accountingEntry.create({
            data: {
              registrationId: reg.id,
              collectiveId: reg.collectiveId,
              amount: cardAmount,
              method: 'CARD',
              paidFor: 'DIPLOMAS_MEDALS',
              paymentGroupId,
            },
          });
        }

        if (transferAmount > 0) {
          await prisma.accountingEntry.create({
            data: {
              registrationId: reg.id,
              collectiveId: reg.collectiveId,
              amount: transferAmount,
              method: 'TRANSFER',
              paidFor: 'DIPLOMAS_MEDALS',
              paymentGroupId,
            },
          });
        }

        await prisma.registration.update({
          where: { id: reg.id },
          data: { diplomasAndMedalsPaid: true },
        });

        await recalculateRegistrationPaymentStatus(reg.id);
      }

      res.json({ success: true, message: 'Payment processed', totalPaid });
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// POST /api/diplomas/:id/cancel-payment
router.post('/:id/cancel-payment', authenticateToken, requireRole('ADMIN', 'REGISTRATOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const registration = await prisma.registration.findUnique({
      where: { id },
      include: {
        accountingEntries: {
          where: { paidFor: 'DIPLOMAS_MEDALS', deletedAt: null },
        },
      },
    });

    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    // Check timeout for REGISTRATOR
    if (req.user?.role === 'REGISTRATOR') {
      const setting = await prisma.systemSetting.findUnique({
        where: { key: 'diploma_cancel_timeout_minutes' },
      });
      const timeoutMinutes = setting ? parseInt(setting.value) : 5;

      const lastPayment = registration.accountingEntries[0];
      if (lastPayment) {
        const minutesSincePayment = (Date.now() - lastPayment.createdAt.getTime()) / (1000 * 60);
        if (minutesSincePayment > timeoutMinutes) {
          res.status(403).json({ error: `Payment can only be cancelled within ${timeoutMinutes} minutes` });
          return;
        }
      }
    }

    // Soft delete entries
    await prisma.accountingEntry.updateMany({
      where: {
        registrationId: id,
        paidFor: 'DIPLOMAS_MEDALS',
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });

    await prisma.registration.update({
      where: { id },
      data: { diplomasAndMedalsPaid: false },
    });

    await recalculateRegistrationPaymentStatus(id);

    res.json({ success: true, message: 'Payment cancelled' });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// PATCH /api/diplomas/:id/printed
router.patch('/:id/printed', authenticateToken, requireRole('ADMIN', 'REGISTRATOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { printed } = req.body;

    const registration = await prisma.registration.update({
      where: { id },
      data: { diplomasPrinted: printed },
    });

    res.json({ id: registration.id, diplomasPrinted: registration.diplomasPrinted, message: 'Updated' });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// PATCH /api/diplomas/bulk-printed
router.patch('/bulk-printed', authenticateToken, requireRole('ADMIN', 'REGISTRATOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { registrationIds, printed } = req.body;

    await prisma.registration.updateMany({
      where: { id: { in: registrationIds } },
      data: { diplomasPrinted: printed },
    });

    res.json({ updated: registrationIds.length, message: 'Updated' });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// DELETE /api/diplomas/:id
router.delete('/:id', authenticateToken, requireRole('ADMIN', 'REGISTRATOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.registration.update({
      where: { id },
      data: { diplomasDataDeletedAt: new Date() },
    });

    res.json({ success: true, deletedAt: new Date() });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/diplomas/:id/restore
router.post('/:id/restore', authenticateToken, requireRole('ADMIN', 'REGISTRATOR'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.registration.update({
      where: { id },
      data: { diplomasDataDeletedAt: null },
    });

    res.json({ success: true, restored: true });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/diplomas/export/pdf?eventId=X&registrationIds=1,2,3
router.get(
  '/export/pdf',
  authenticateToken,
  requireRole('ADMIN', 'REGISTRATOR'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const eventId = parseInt(req.query.eventId as string);
      const registrationIdsParam = req.query.registrationIds as string;

      if (!eventId) {
        res.status(400).json({ error: 'eventId is required' });
        return;
      }

      const event = await prisma.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        res.status(404).json({ error: 'Event not found' });
        return;
      }

      let registrationIds: number[] | undefined;
      if (registrationIdsParam) {
        registrationIds = registrationIdsParam.split(',').map((id) => parseInt(id.trim()));
      }

      const where: any = {
        eventId,
        diplomasDataDeletedAt: null,
      };

      if (registrationIds && registrationIds.length > 0) {
        where.id = { in: registrationIds };
      }

      const registrations = await prisma.registration.findMany({
        where,
        include: {
          collective: true,
          discipline: true,
          nomination: true,
          age: true,
          category: true,
        },
        orderBy: [
          { blockNumber: 'asc' },
          { number: 'asc' },
        ],
      });

      if (registrations.length === 0) {
        res.status(404).json({ error: 'No registrations found' });
        return;
      }

      // Create PDF document
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      const filename = registrationIds && registrationIds.length === 1
        ? `diploma_${registrationIds[0]}_${Date.now()}.pdf`
        : `diplomas_${eventId}_${Date.now()}.pdf`;
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

      // Pipe PDF to response
      doc.pipe(res);

      // Process each registration
      registrations.forEach((reg, index) => {
        if (index > 0) {
          doc.addPage();
        }

        // Header
        doc.fontSize(18).text(`Диплом`, { align: 'center' });
        doc.moveDown();
        doc.fontSize(14).text(`Мероприятие: ${event.name}`, { align: 'center' });
        doc.moveDown(2);

        // Registration details
        doc.fontSize(12);
        doc.text(`Коллектив: ${reg.collective.name}`, { continued: false });
        doc.text(`Дисциплина: ${reg.discipline.name}`);
        doc.text(`Номинация: ${reg.nomination.name}`);
        doc.text(`Возрастная категория: ${reg.age.name}`);
        if (reg.category) {
          doc.text(`Категория: ${reg.category.name}`);
        }
        if (reg.danceName) {
          doc.text(`Название номера: ${reg.danceName}`);
        }

        // Человекочитаемый номер: блок.номерВнутриБлока (например, 29.1)
        let displayNumber = '-';
        if (reg.blockNumber && reg.number) {
          const index = reg.number % 1000 || 0;
          displayNumber = index > 0 ? `${reg.blockNumber}.${index}` : String(reg.blockNumber);
        } else if (reg.number) {
          displayNumber = String(reg.number);
        }

        doc.text(`Блок: ${reg.blockNumber || '-'}, Номер: ${displayNumber}`);
        doc.moveDown();

        // Diplomas list
        if (reg.diplomasList) {
          doc.fontSize(14).text('Список дипломов:', { underline: true });
          doc.moveDown();
          doc.fontSize(11);
          const diplomas = reg.diplomasList.split('\n').filter((name) => name.trim());
          diplomas.forEach((name, i) => {
            doc.text(`${i + 1}. ${name.trim()}`);
          });
          doc.moveDown();
        }

        // Medals count
        if (reg.medalsCount > 0) {
          doc.fontSize(12).text(`Количество медалей: ${reg.medalsCount}`);
        }

        // Footer
        doc.moveDown(2);
        doc.fontSize(10).text(
          `Дата формирования: ${new Date().toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}`,
          { align: 'center' }
        );
      });

      // Finalize PDF
      doc.end();
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

export default router;

