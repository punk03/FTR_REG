import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// Публичный endpoint для получения данных калькулятора (без авторизации)
// GET /api/public/calculator/:token
router.get('/:token', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const event = await prisma.event.findUnique({
      where: { calculatorToken: token },
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

    // Возвращаем только необходимые данные для калькулятора
    res.json({
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      pricePerDiploma: event.pricePerDiploma ? Number(event.pricePerDiploma) : null,
      pricePerMedal: event.pricePerMedal ? Number(event.pricePerMedal) : null,
      eventPrices: event.eventPrices.map((price: any) => ({
        nominationId: price.nominationId,
        nominationName: price.nomination.name,
        pricePerParticipant: Number(price.pricePerParticipant),
        pricePerFederationParticipant: price.pricePerFederationParticipant ? Number(price.pricePerFederationParticipant) : Number(price.pricePerParticipant),
      })),
    });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// Публичный endpoint для расчета стоимости (без авторизации)
// POST /api/public/calculator/:token/calculate
router.post('/:token/calculate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { participantsCount, federationParticipantsCount, nominationId, diplomasCount, medalsCount } = req.body;

    const event = await prisma.event.findUnique({
      where: { calculatorToken: token },
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

    // Находим цену для выбранной номинации
    let eventPrice = null;
    if (nominationId) {
      eventPrice = event.eventPrices.find((price: any) => price.nominationId === parseInt(nominationId));
    }

    if (!eventPrice) {
      res.status(400).json({ error: 'Nomination price not found' });
      return;
    }

    const regularCount = Math.max(0, (participantsCount || 0) - (federationParticipantsCount || 0));
    const regularPrice = Number(eventPrice.pricePerParticipant) * regularCount;
    const federationPrice = Number(eventPrice.pricePerFederationParticipant || eventPrice.pricePerParticipant) * (federationParticipantsCount || 0);
    const performancePrice = regularPrice + federationPrice;

    const diplomasPrice = event.pricePerDiploma && diplomasCount ? Number(event.pricePerDiploma) * diplomasCount : 0;
    const medalsPrice = event.pricePerMedal && medalsCount ? Number(event.pricePerMedal) * medalsCount : 0;

    const totalPrice = performancePrice + diplomasPrice + medalsPrice;

    res.json({
      performancePrice,
      diplomasPrice,
      medalsPrice,
      totalPrice,
      breakdown: {
        regularParticipants: regularCount,
        regularPrice,
        federationParticipants: federationParticipantsCount || 0,
        federationPrice,
        diplomasCount: diplomasCount || 0,
        diplomasPrice,
        medalsCount: medalsCount || 0,
        medalsPrice,
      },
    });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

export default router;

