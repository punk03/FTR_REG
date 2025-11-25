import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { paymentRateLimiter } from '../middleware/rateLimit';
import { cacheService } from '../services/cacheService';
import {
  recalculateRegistrationPaymentStatus,
  calculateDiscount,
  generatePaymentGroupId,
} from '../services/paymentService';
import { emailService } from '../services/emailService';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/payments/create
router.post(
  '/create',
  authenticateToken,
  requireRole('ADMIN', 'REGISTRATOR'),
  paymentRateLimiter,
  [
    body('registrationIds').isArray({ min: 1 }).withMessage('At least one registrationId is required'),
    body('paymentsByMethod').isObject().withMessage('paymentsByMethod is required'),
    body('payingPerformance').isBoolean().withMessage('payingPerformance is required'),
    body('payingDiplomasAndMedals').isBoolean().withMessage('payingDiplomasAndMedals is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const {
        registrationIds,
        paymentsByMethod,
        payingPerformance,
        payingDiplomasAndMedals,
        applyDiscount,
        paymentGroupName,
        registrationsData,
      } = req.body;

      const cash = paymentsByMethod.cash || 0;
      const card = paymentsByMethod.card || 0;
      const transfer = paymentsByMethod.transfer || 0;
      const totalPaid = cash + card + transfer;

      // Calculate total required
      let totalRequired = 0;
      let totalPerformanceRequired = 0;
      let totalDiplomasAndMedalsRequired = 0;

      const registrations = await prisma.registration.findMany({
        where: { id: { in: registrationIds } },
        include: {
          event: true,
          nomination: true,
        },
      });

      for (const reg of registrations) {
        const regData = registrationsData?.find((r: any) => r.registrationId === reg.id);
        const participantsCount = regData?.participantsCount ?? reg.participantsCount;
        const federationParticipantsCount = regData?.federationParticipantsCount ?? reg.federationParticipantsCount;
        const diplomasCount = regData?.diplomasCount ?? reg.diplomasCount;
        const medalsCount = regData?.medalsCount ?? reg.medalsCount;

        // Get event price
        const eventPrice = await prisma.eventPrice.findUnique({
          where: {
            eventId_nominationId: {
              eventId: reg.eventId,
              nominationId: reg.nominationId,
            },
          },
        });

        if (eventPrice && payingPerformance) {
          const regularCount = Math.max(0, participantsCount - federationParticipantsCount);
          const regularPrice = Number(eventPrice.pricePerParticipant) * regularCount;
          const federationPrice =
            Number(eventPrice.pricePerFederationParticipant || eventPrice.pricePerParticipant) * federationParticipantsCount;
          totalPerformanceRequired += regularPrice + federationPrice;
        }

        if (payingDiplomasAndMedals) {
          const diplomasPrice = reg.event.pricePerDiploma ? Number(reg.event.pricePerDiploma) * diplomasCount : 0;
          const medalsPrice = reg.event.pricePerMedal ? Number(reg.event.pricePerMedal) * medalsCount : 0;
          totalDiplomasAndMedalsRequired += diplomasPrice + medalsPrice;
        }
      }

      totalRequired = totalPerformanceRequired + totalDiplomasAndMedalsRequired;

      // Apply discount if requested (only for performance)
      let discountAmount = 0;
      // let discountPercent = 0;
      if (applyDiscount && payingPerformance && registrations.length > 0) {
        const event = registrations[0].event;
        const discount = calculateDiscount(totalPerformanceRequired, event.discountTiers);
        discountAmount = discount.discountAmount;
        discountPercent = discount.discountPercent;
        totalRequired = totalPerformanceRequired - discountAmount + totalDiplomasAndMedalsRequired;
      }

      // Validate payment amount
      if (Math.abs(totalPaid - totalRequired) > 0.01) {
        res.status(400).json({
          error: 'Payment amount mismatch',
          totalPaid,
          totalRequired,
          difference: totalPaid - totalRequired,
        });
        return;
      }

      // Create payment group
      const paymentGroupId = registrations.length > 1 ? generatePaymentGroupId() : null;

      // Create accounting entries
      const results = [];
      for (const reg of registrations) {
        const regData = registrationsData?.find((r: any) => r.registrationId === reg.id);
        const participantsCount = regData?.participantsCount ?? reg.participantsCount;
        const federationParticipantsCount = regData?.federationParticipantsCount ?? reg.federationParticipantsCount;
        const diplomasCount = regData?.diplomasCount ?? reg.diplomasCount;
        const medalsCount = regData?.medalsCount ?? reg.medalsCount;

        // Update registration if data provided
        if (regData) {
          await prisma.registration.update({
            where: { id: reg.id },
            data: {
              participantsCount,
              federationParticipantsCount,
              diplomasCount,
              medalsCount,
              diplomasList: regData.diplomasList,
            },
          });
        }

        // Calculate amounts for this registration
        const eventPrice = await prisma.eventPrice.findUnique({
          where: {
            eventId_nominationId: {
              eventId: reg.eventId,
              nominationId: reg.nominationId,
            },
          },
        });

        let regPerformanceAmount = 0;
        if (eventPrice && payingPerformance) {
          const regularCount = Math.max(0, participantsCount - federationParticipantsCount);
          const regularPrice = Number(eventPrice.pricePerParticipant) * regularCount;
          const federationPrice =
            Number(eventPrice.pricePerFederationParticipant || eventPrice.pricePerParticipant) * federationParticipantsCount;
          regPerformanceAmount = regularPrice + federationPrice;
        }

        let regDiplomasAmount = 0;
        if (payingDiplomasAndMedals) {
          const diplomasPrice = reg.event.pricePerDiploma ? Number(reg.event.pricePerDiploma) * diplomasCount : 0;
          const medalsPrice = reg.event.pricePerMedal ? Number(reg.event.pricePerMedal) * medalsCount : 0;
          regDiplomasAmount = diplomasPrice + medalsPrice;
        }

        const regTotal = regPerformanceAmount + regDiplomasAmount;
        // const regProportion = totalRequired > 0 ? regTotal / totalRequired : 0;

        // Apply discount proportionally
        let regDiscountAmount = 0;
        if (applyDiscount && payingPerformance && regPerformanceAmount > 0) {
          regDiscountAmount = (discountAmount * regPerformanceAmount) / totalPerformanceRequired;
        }

        // Create accounting entries
        if (payingPerformance && regPerformanceAmount > 0) {
          const finalAmount = regPerformanceAmount - regDiscountAmount;
          const cashAmount = Math.round(cash * (finalAmount / totalRequired));
          const cardAmount = Math.round(card * (finalAmount / totalRequired));
          const transferAmount = finalAmount - cashAmount - cardAmount;

          if (cashAmount > 0) {
            await prisma.accountingEntry.create({
              data: {
                registrationId: reg.id,
                collectiveId: reg.collectiveId,
                amount: cashAmount,
                discountAmount: regDiscountAmount * (cashAmount / finalAmount),
                discountPercent: regDiscountAmount > 0 ? (regDiscountAmount / regPerformanceAmount) * 100 : 0,
                method: 'CASH',
                paidFor: 'PERFORMANCE',
                paymentGroupId,
                paymentGroupName: paymentGroupName || null,
              },
            });
          }

          if (cardAmount > 0) {
            await prisma.accountingEntry.create({
              data: {
                registrationId: reg.id,
                collectiveId: reg.collectiveId,
                amount: cardAmount,
                discountAmount: regDiscountAmount * (cardAmount / finalAmount),
                discountPercent: regDiscountAmount > 0 ? (regDiscountAmount / regPerformanceAmount) * 100 : 0,
                method: 'CARD',
                paidFor: 'PERFORMANCE',
                paymentGroupId,
                paymentGroupName: paymentGroupName || null,
              },
            });
          }

          if (transferAmount > 0) {
            await prisma.accountingEntry.create({
              data: {
                registrationId: reg.id,
                collectiveId: reg.collectiveId,
                amount: transferAmount,
                discountAmount: regDiscountAmount * (transferAmount / finalAmount),
                discountPercent: regDiscountAmount > 0 ? (regDiscountAmount / regPerformanceAmount) * 100 : 0,
                method: 'TRANSFER',
                paidFor: 'PERFORMANCE',
                paymentGroupId,
                paymentGroupName: paymentGroupName || null,
              },
            });
          }
        }

        if (payingDiplomasAndMedals && regDiplomasAmount > 0) {
          const cashAmount = Math.round(cash * (regDiplomasAmount / totalRequired));
          const cardAmount = Math.round(card * (regDiplomasAmount / totalRequired));
          const transferAmount = regDiplomasAmount - cashAmount - cardAmount;

          if (cashAmount > 0) {
            await prisma.accountingEntry.create({
              data: {
                registrationId: reg.id,
                collectiveId: reg.collectiveId,
                amount: cashAmount,
                method: 'CASH',
                paidFor: 'DIPLOMAS_MEDALS',
                paymentGroupId,
                paymentGroupName: paymentGroupName || null,
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
                paymentGroupName: paymentGroupName || null,
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
                paymentGroupName: paymentGroupName || null,
              },
            });
          }
        }

        // Recalculate status
        await recalculateRegistrationPaymentStatus(reg.id);

        results.push({ regId: reg.id, success: true });
      }

      // Send email notification (non-blocking)
      if (emailService.isEnabled()) {
        const user = await prisma.user.findUnique({ where: { id: (req as any).user.id } });
        if (user) {
          emailService.sendPaymentCreatedNotification(user.email, {
            registrationIds: registrationIds,
            totalAmount: totalPaid,
            discountAmount: discountAmount,
            paymentGroupName: paymentGroupName || undefined,
          }).catch((error) => {
            console.error('Error sending payment created email:', error);
          });
        }
      }

      res.json({
        success: true,
        results,
        totalPaid,
        totalToPay: totalRequired,
        discount: discountAmount,
      });
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

export default router;

