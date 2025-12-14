import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { paymentRateLimiter } from '../middleware/rateLimit';
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
        paymentComponents, // Массив объектов { registrationId, payPerformance, payDiplomas, payMedals }
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
        const regPaymentComponents = paymentComponents?.find((pc: any) => pc.registrationId === reg.id);
        const participantsCount = regData?.participantsCount ?? reg.participantsCount;
        const federationParticipantsCount = regData?.federationParticipantsCount ?? reg.federationParticipantsCount;
        // Если есть diplomasList, считаем количество строк, иначе используем diplomasCount
        let diplomasCount = reg.diplomasCount;
        if (regData?.diplomasList) {
          diplomasCount = regData.diplomasList.split('\n').filter((s: string) => s.trim()).length;
        } else if (regData?.diplomasCount !== undefined) {
          diplomasCount = regData.diplomasCount;
        }
        const medalsCount = regData?.medalsCount ?? reg.medalsCount;

        // Проверяем уникальную цену выступления
        const customPerformancePrice = regData?.customPerformancePrice;
        
        // Учитываем только если главный чекбокс включен И чекбокс для этого танца включен
        if (payingPerformance && (regPaymentComponents?.payPerformance ?? true)) {
          if (customPerformancePrice !== undefined && customPerformancePrice !== null) {
            // Используем уникальную цену
            totalPerformanceRequired += Number(customPerformancePrice);
          } else {
            // Используем стандартный расчет
            const eventPrice = await prisma.eventPrice.findUnique({
              where: {
                eventId_nominationId: {
                  eventId: reg.eventId,
                  nominationId: reg.nominationId,
                },
              },
            });

            if (eventPrice) {
              const regularCount = Math.max(0, participantsCount - federationParticipantsCount);
              const regularPrice = Number(eventPrice.pricePerParticipant) * regularCount;
              const federationPrice =
                Number(eventPrice.pricePerFederationParticipant || eventPrice.pricePerParticipant) * federationParticipantsCount;
              totalPerformanceRequired += regularPrice + federationPrice;
            }
          }
        }

        if (payingDiplomasAndMedals) {
          const diplomasPrice = (regPaymentComponents?.payDiplomas ?? true) && reg.event.pricePerDiploma 
            ? Number(reg.event.pricePerDiploma) * diplomasCount 
            : 0;
          const medalsPrice = (regPaymentComponents?.payMedals ?? true) && reg.event.pricePerMedal 
            ? Number(reg.event.pricePerMedal) * medalsCount 
            : 0;
          totalDiplomasAndMedalsRequired += diplomasPrice + medalsPrice;
        }
      }

      totalRequired = totalPerformanceRequired + totalDiplomasAndMedalsRequired;

      // Apply discount if requested (only for performance)
      let discountAmount = 0;
      if (applyDiscount && payingPerformance && registrations.length > 0) {
        const event = registrations[0].event;
        const discount = calculateDiscount(totalPerformanceRequired, event.discountTiers);
        discountAmount = discount.discountAmount;
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
        const regPaymentComponents = paymentComponents?.find((pc: any) => pc.registrationId === reg.id);
        const participantsCount = regData?.participantsCount ?? reg.participantsCount;
        const federationParticipantsCount = regData?.federationParticipantsCount ?? reg.federationParticipantsCount;
        // Если есть diplomasList, считаем количество строк, иначе используем diplomasCount
        let diplomasCount = reg.diplomasCount;
        if (regData?.diplomasList) {
          diplomasCount = regData.diplomasList.split('\n').filter((s: string) => s.trim()).length;
        } else if (regData?.diplomasCount !== undefined) {
          diplomasCount = regData.diplomasCount;
        }
        const medalsCount = regData?.medalsCount ?? reg.medalsCount;

        // Update registration if data provided
        // Обновляем регистрацию, если переданы данные, даже если некоторые поля пустые
        // Это позволяет обновлять данные о дипломах/медалях даже без их оплаты
        if (regData) {
          const updateData: any = {
            participantsCount,
            federationParticipantsCount,
            diplomasCount,
            medalsCount,
          };
          
          // Всегда обновляем diplomasList, если он передан в regData
          // Может быть пустой строкой или null для очистки
          if (regData.diplomasList !== undefined) {
            updateData.diplomasList = regData.diplomasList || null;
          } else {
            // Если diplomasList не передан, но diplomasCount изменился, обновляем его
            updateData.diplomasList = reg.diplomasList;
          }
          
          // Обновляем все поля регистрации, если они переданы
          if (regData.danceName !== undefined) {
            updateData.danceName = regData.danceName;
          }
          if (regData.collectiveId !== undefined) {
            updateData.collectiveId = regData.collectiveId;
          }
          if (regData.disciplineId !== undefined) {
            updateData.disciplineId = regData.disciplineId;
          }
          if (regData.nominationId !== undefined) {
            updateData.nominationId = regData.nominationId;
          }
          if (regData.ageId !== undefined) {
            updateData.ageId = regData.ageId;
          }
          if (regData.categoryId !== undefined) {
            updateData.categoryId = regData.categoryId;
          }
          
          await prisma.registration.update({
            where: { id: reg.id },
            data: updateData,
          });
        }

        // Calculate amounts for this registration
        // Проверяем уникальную цену выступления
        const customPerformancePrice = regData?.customPerformancePrice;
        let regPerformanceAmount = 0;
        
        // Учитываем только если главный чекбокс включен И чекбокс для этого танца включен
        if (payingPerformance && (regPaymentComponents?.payPerformance ?? true)) {
          if (customPerformancePrice !== undefined && customPerformancePrice !== null) {
            // Используем уникальную цену
            regPerformanceAmount = Number(customPerformancePrice);
          } else {
            // Используем стандартный расчет
            const eventPrice = await prisma.eventPrice.findUnique({
              where: {
                eventId_nominationId: {
                  eventId: reg.eventId,
                  nominationId: reg.nominationId,
                },
              },
            });

            if (eventPrice) {
              const regularCount = Math.max(0, participantsCount - federationParticipantsCount);
              const regularPrice = Number(eventPrice.pricePerParticipant) * regularCount;
              const federationPrice =
                Number(eventPrice.pricePerFederationParticipant || eventPrice.pricePerParticipant) * federationParticipantsCount;
              regPerformanceAmount = regularPrice + federationPrice;
            }
          }
        }

        // Рассчитываем суммы дипломов и медалей отдельно
        const regDiplomasPrice = (regPaymentComponents?.payDiplomas ?? true) && reg.event.pricePerDiploma 
          ? Number(reg.event.pricePerDiploma) * diplomasCount 
          : 0;
        const regMedalsPrice = (regPaymentComponents?.payMedals ?? true) && reg.event.pricePerMedal 
          ? Number(reg.event.pricePerMedal) * medalsCount 
          : 0;

        // const regTotal = regPerformanceAmount + regDiplomasAmount;
        // const regProportion = totalRequired > 0 ? regTotal / totalRequired : 0;

        // Apply discount proportionally
        let regDiscountAmount = 0;
        if (applyDiscount && payingPerformance && regPerformanceAmount > 0) {
          regDiscountAmount = (discountAmount * regPerformanceAmount) / totalPerformanceRequired;
        }

        // Рассчитываем общую сумму, которая должна быть оплачена для этого танца
        const regTotalRequired = 
          (payingPerformance && (regPaymentComponents?.payPerformance ?? true) ? regPerformanceAmount - regDiscountAmount : 0) +
          (payingDiplomasAndMedals && (regPaymentComponents?.payDiplomas ?? true) ? regDiplomasPrice : 0) +
          (payingDiplomasAndMedals && (regPaymentComponents?.payMedals ?? true) ? regMedalsPrice : 0);

        // Пропорция этого танца от общей суммы всех оплачиваемых компонентов
        const regProportion = totalRequired > 0 ? regTotalRequired / totalRequired : 0;

        // Create accounting entries
        // Учитываем только если главный чекбокс включен И чекбокс для этого танца включен
        if (payingPerformance && (regPaymentComponents?.payPerformance ?? true) && regPerformanceAmount > 0) {
          const finalAmount = regPerformanceAmount - regDiscountAmount;
          // Распределяем платежи пропорционально доле выступления этого танца от общей суммы
          const performanceProportion = regTotalRequired > 0 ? finalAmount / regTotalRequired : 0;
          const cashAmount = Math.round(cash * regProportion * performanceProportion);
          const cardAmount = Math.round(card * regProportion * performanceProportion);
          // Transfer получает остаток, чтобы сумма точно совпадала
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

        // Разделяем оплату дипломов и медалей на отдельные записи
        // Оплата дипломов
        if (payingDiplomasAndMedals && (regPaymentComponents?.payDiplomas ?? true) && regDiplomasPrice > 0) {
          // Распределяем платежи пропорционально доле дипломов этого танца от общей суммы танца
          const diplomasProportion = regTotalRequired > 0 ? regDiplomasPrice / regTotalRequired : 0;
          const cashAmount = Math.round(cash * regProportion * diplomasProportion);
          const cardAmount = Math.round(card * regProportion * diplomasProportion);
          // Transfer получает остаток, чтобы сумма точно совпадала с regDiplomasPrice
          const transferAmount = regDiplomasPrice - cashAmount - cardAmount;

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

        // Оплата медалей
        if (payingDiplomasAndMedals && (regPaymentComponents?.payMedals ?? true) && regMedalsPrice > 0) {
          // Распределяем платежи пропорционально доле медалей этого танца от общей суммы танца
          const medalsProportion = regTotalRequired > 0 ? regMedalsPrice / regTotalRequired : 0;
          const cashAmount = Math.round(cash * regProportion * medalsProportion);
          const cardAmount = Math.round(card * regProportion * medalsProportion);
          // Transfer получает остаток, чтобы сумма точно совпадала с regMedalsPrice
          const transferAmount = regMedalsPrice - cashAmount - cardAmount;

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

