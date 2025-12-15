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
    const pricePerRegularParticipant = Number(eventPrice.pricePerParticipant);
    const pricePerFederationParticipant = Number(eventPrice.pricePerFederationParticipant || eventPrice.pricePerParticipant);
    const regularPrice = pricePerRegularParticipant * regularCount;
    const federationPrice = pricePerFederationParticipant * (federationParticipantsCount || 0);
    const performancePrice = regularPrice + federationPrice;

    const pricePerDiploma = event.pricePerDiploma ? Number(event.pricePerDiploma) : 0;
    const pricePerMedal = event.pricePerMedal ? Number(event.pricePerMedal) : 0;
    const diplomasPrice = pricePerDiploma && diplomasCount ? pricePerDiploma * diplomasCount : 0;
    const medalsPrice = pricePerMedal && medalsCount ? pricePerMedal * medalsCount : 0;

    const totalPrice = performancePrice + diplomasPrice + medalsPrice;

    res.json({
      performancePrice,
      diplomasPrice,
      medalsPrice,
      totalPrice,
      breakdown: {
        regularParticipants: regularCount,
        regularPrice,
        pricePerRegularParticipant,
        federationParticipants: federationParticipantsCount || 0,
        federationPrice,
        pricePerFederationParticipant,
        diplomasCount: diplomasCount || 0,
        diplomasPrice,
        pricePerDiploma,
        medalsCount: medalsCount || 0,
        medalsPrice,
        pricePerMedal,
        nominationName: eventPrice.nomination.name,
        totalParticipants: participantsCount || 0,
      },
    });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

export default router;

