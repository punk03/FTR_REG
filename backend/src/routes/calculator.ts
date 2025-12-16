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

// Публичный endpoint для получения списка регистраций события (без авторизации)
// GET /api/public/calculator/:token/registrations
router.get('/:token/registrations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;

    const event = await prisma.event.findUnique({
      where: { calculatorToken: token },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id },
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
      select: {
        id: true,
        danceName: true,
        participantsCount: true,
        federationParticipantsCount: true,
        diplomasCount: true,
        medalsCount: true,
        diplomasList: true,
        paymentStatus: true,
        collective: true,
        discipline: true,
        nomination: true,
        age: true,
        category: true,
        leaders: { include: { person: true } },
        trainers: { include: { person: true } },
      },
    });

    res.json({ registrations });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// Публичный endpoint для расчета объединённой оплаты (без авторизации, только расчет)
// POST /api/public/calculator/:token/calculate-combined
router.post('/:token/calculate-combined', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { registrationIds, customDiplomasCounts, customMedalsCounts, customParticipantsCounts, customFederationParticipantsCounts } = req.body;

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

    if (!registrationIds || !Array.isArray(registrationIds) || registrationIds.length === 0) {
      res.status(400).json({ error: 'Registration IDs are required' });
      return;
    }

    // Получаем регистрации
    const registrations = await prisma.registration.findMany({
      where: {
        id: { in: registrationIds.map((id: any) => parseInt(id)) },
        eventId: event.id,
      },
      include: {
        nomination: true,
      },
    });

    if (registrations.length !== registrationIds.length) {
      res.status(400).json({ error: 'Some registrations not found' });
      return;
    }

    const pricePerDiploma = event.pricePerDiploma ? Number(event.pricePerDiploma) : 0;
    const pricePerMedal = event.pricePerMedal ? Number(event.pricePerMedal) : 0;

    let totalPerformancePrice = 0;
    let totalDiplomasPrice = 0;
    let totalMedalsPrice = 0;

    const breakdown: any[] = [];

    for (const reg of registrations) {
      // Находим цену для номинации регистрации
      const eventPrice = event.eventPrices.find((price: any) => price.nominationId === reg.nominationId);
      
      if (!eventPrice) {
        continue;
      }

      // Используем кастомное количество участников если указано, иначе из регистрации
      const participantsCount = customParticipantsCounts?.[reg.id] !== undefined
        ? parseInt(customParticipantsCounts[reg.id]) || 0
        : (reg.participantsCount || 0);
      const federationParticipantsCount = customFederationParticipantsCounts?.[reg.id] !== undefined
        ? parseInt(customFederationParticipantsCounts[reg.id]) || 0
        : (reg.federationParticipantsCount || 0);

      const regularCount = Math.max(0, participantsCount - federationParticipantsCount);
      const pricePerRegularParticipant = Number(eventPrice.pricePerParticipant);
      const pricePerFederationParticipant = Number(eventPrice.pricePerFederationParticipant || eventPrice.pricePerParticipant);
      const regularPrice = pricePerRegularParticipant * regularCount;
      const federationPrice = pricePerFederationParticipant * federationParticipantsCount;
      const regPerformancePrice = regularPrice + federationPrice;

      // Используем кастомное количество дипломов/медалей если указано, иначе из регистрации
      const diplomasCount = customDiplomasCounts?.[reg.id] !== undefined 
        ? parseInt(customDiplomasCounts[reg.id]) || 0
        : (reg.diplomasCount || 0);
      const medalsCount = customMedalsCounts?.[reg.id] !== undefined
        ? parseInt(customMedalsCounts[reg.id]) || 0
        : (reg.medalsCount || 0);

      const regDiplomasPrice = pricePerDiploma * diplomasCount;
      const regMedalsPrice = pricePerMedal * medalsCount;

      totalPerformancePrice += regPerformancePrice;
      totalDiplomasPrice += regDiplomasPrice;
      totalMedalsPrice += regMedalsPrice;

      breakdown.push({
        registrationId: reg.id,
        danceName: reg.danceName,
        collectiveName: reg.collective?.name || '',
        performancePrice: regPerformancePrice,
        diplomasPrice: regDiplomasPrice,
        medalsPrice: regMedalsPrice,
        diplomasCount,
        medalsCount,
      });
    }

    const totalPrice = totalPerformancePrice + totalDiplomasPrice + totalMedalsPrice;

    res.json({
      totalPrice,
      totalPerformancePrice,
      totalDiplomasPrice,
      totalMedalsPrice,
      breakdown,
    });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

export default router;

