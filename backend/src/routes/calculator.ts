import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { errorHandler } from '../middleware/errorHandler';
import { authenticateToken, requireRole } from '../middleware/auth';

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
// GET /api/public/calculator/:token/registrations?search=...
router.get('/:token/registrations', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { search } = req.query;

    const event = await prisma.event.findUnique({
      where: { calculatorToken: token },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Формируем условие поиска
    const where: any = { eventId: event.id };
    
    if (search && typeof search === 'string' && search.trim()) {
      const searchLower = search.trim().toLowerCase();
      where.OR = [
        { danceName: { contains: searchLower, mode: 'insensitive' } },
        { collective: { name: { contains: searchLower, mode: 'insensitive' } } },
        { leaders: { some: { person: { fullName: { contains: searchLower, mode: 'insensitive' } } } } },
        { trainers: { some: { person: { fullName: { contains: searchLower, mode: 'insensitive' } } } } },
      ];
    }

    const registrations = await prisma.registration.findMany({
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
    });

    res.json({ registrations });
  } catch (error) {
    console.error('Error fetching registrations for calculator:', error);
    errorHandler(error as Error, req, res, () => {});
  }
});

// Публичный endpoint для расчета объединённой оплаты (без авторизации, только расчет)
// POST /api/public/calculator/:token/calculate-combined
router.post('/:token/calculate-combined', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { registrationIds, customDiplomasCounts, customMedalsCounts, customParticipantsCounts, customFederationParticipantsCounts, customNominationIds } = req.body;

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
      select: {
        id: true,
        danceName: true,
        participantsCount: true,
        federationParticipantsCount: true,
        diplomasCount: true,
        medalsCount: true,
        nominationId: true,
        nomination: {
          select: {
            id: true,
            name: true,
          },
        },
        collective: {
          select: {
            id: true,
            name: true,
          },
        },
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
      // Используем кастомный nominationId если указан, иначе из регистрации
      const nominationId = customNominationIds?.[reg.id] !== undefined
        ? parseInt(customNominationIds[reg.id])
        : reg.nominationId;
      
      // Находим цену для номинации регистрации
      const eventPrice = event.eventPrices.find((price: any) => price.nominationId === nominationId);
      
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

// Защищенный endpoint для получения ведомости (требует авторизации)
// GET /api/public/calculator/:token/statement?includeDeleted=true
router.get('/:token/statement', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const includeDeleted = req.query.includeDeleted === 'true';

    const event = await prisma.event.findUnique({
      where: { calculatorToken: token },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Формируем условие для фильтрации удаленных записей
    const where: any = {
      eventId: event.id,
    };
    
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    // Получаем все записи ведомости для этого события (отдельная таблица, не связанная с регистрациями)
    const entries = await prisma.calculatorStatement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Формируем список записей для ведомости
    const statementEntries = entries.map((entry: { id: number; collectiveName: string; amount: any; method: string; paidFor: string; deletedAt: Date | null; createdAt: Date }) => ({
      id: entry.id,
      collectiveName: entry.collectiveName,
      amount: Number(entry.amount),
      method: entry.method, // CASH, CARD, TRANSFER
      paidFor: entry.paidFor, // PERFORMANCE, DIPLOMAS_MEDALS
      deletedAt: entry.deletedAt,
      createdAt: entry.createdAt,
    }));

    // Подсчитываем статистику (только для неудаленных записей)
    const stats = {
      byMethod: {
        CASH: 0,
        CARD: 0,
        TRANSFER: 0,
      },
      byPaidFor: {
        PERFORMANCE: 0,
        DIPLOMAS_MEDALS: 0,
      },
      total: 0,
    };

    statementEntries
      .filter((entry: { deletedAt: Date | null }) => !entry.deletedAt)
      .forEach((entry: { method: string; paidFor: string; amount: number }) => {
        stats.byMethod[entry.method as keyof typeof stats.byMethod] += entry.amount;
        stats.byPaidFor[entry.paidFor as keyof typeof stats.byPaidFor] += entry.amount;
        stats.total += entry.amount;
      });

    res.json({
      entries: statementEntries,
      statistics: stats,
    });
  } catch (error) {
    console.error('Error fetching statement:', error);
    errorHandler(error as Error, req, res, () => {});
  }
});

// Защищенный endpoint для создания записи ведомости (требует авторизации)
// POST /api/public/calculator/:token/statement
router.post('/:token/statement', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.params;
    const { collectiveName, amount, method, paidFor } = req.body;

    // Валидация
    if (!collectiveName || typeof collectiveName !== 'string' || !collectiveName.trim()) {
      res.status(400).json({ error: 'Название коллектива обязательно' });
      return;
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'Сумма должна быть положительным числом' });
      return;
    }

    if (!['CASH', 'CARD', 'TRANSFER'].includes(method)) {
      res.status(400).json({ error: 'Способ оплаты должен быть: CASH, CARD или TRANSFER' });
      return;
    }

    if (!['PERFORMANCE', 'DIPLOMAS_MEDALS'].includes(paidFor)) {
      res.status(400).json({ error: 'Назначение должно быть: PERFORMANCE или DIPLOMAS_MEDALS' });
      return;
    }

    const event = await prisma.event.findUnique({
      where: { calculatorToken: token },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Создаем запись ведомости в отдельной таблице (не связанной с регистрациями)
    const entry = await prisma.calculatorStatement.create({
      data: {
        eventId: event.id,
        collectiveName: collectiveName.trim(),
        amount: amount,
        method: method as 'CASH' | 'CARD' | 'TRANSFER',
        paidFor: paidFor as 'PERFORMANCE' | 'DIPLOMAS_MEDALS',
      },
    });

    res.json({
      id: entry.id,
      collectiveName: entry.collectiveName,
      amount: Number(entry.amount),
      method: entry.method,
      paidFor: entry.paidFor,
      deletedAt: entry.deletedAt,
      createdAt: entry.createdAt,
    });
  } catch (error) {
    console.error('Error creating statement entry:', error);
    errorHandler(error as Error, req, res, () => {});
  }
});

// Защищенный endpoint для мягкого удаления записи ведомости (требует авторизации, только ADMIN)
// DELETE /api/public/calculator/:token/statement/:id
router.delete('/:token/statement/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, id } = req.params;
    const entryId = parseInt(id);

    const event = await prisma.event.findUnique({
      where: { calculatorToken: token },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Проверяем, что запись существует и принадлежит этому событию
    const entry = await prisma.calculatorStatement.findFirst({
      where: {
        id: entryId,
        eventId: event.id,
      },
    });

    if (!entry) {
      res.status(404).json({ error: 'Statement entry not found' });
      return;
    }

    // Мягкое удаление
    const updatedEntry = await prisma.calculatorStatement.update({
      where: { id: entryId },
      data: { deletedAt: new Date() },
    });

    res.json({
      id: updatedEntry.id,
      collectiveName: updatedEntry.collectiveName,
      amount: Number(updatedEntry.amount),
      method: updatedEntry.method,
      paidFor: updatedEntry.paidFor,
      deletedAt: updatedEntry.deletedAt,
      createdAt: updatedEntry.createdAt,
    });
  } catch (error) {
    console.error('Error deleting statement entry:', error);
    errorHandler(error as Error, req, res, () => {});
  }
});

// Защищенный endpoint для восстановления записи ведомости (требует авторизации, только ADMIN)
// POST /api/public/calculator/:token/statement/:id/restore
router.post('/:token/statement/:id/restore', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, id } = req.params;
    const entryId = parseInt(id);

    const event = await prisma.event.findUnique({
      where: { calculatorToken: token },
    });

    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Проверяем, что запись существует и принадлежит этому событию
    const entry = await prisma.calculatorStatement.findFirst({
      where: {
        id: entryId,
        eventId: event.id,
      },
    });

    if (!entry) {
      res.status(404).json({ error: 'Statement entry not found' });
      return;
    }

    // Восстановление записи
    const updatedEntry = await prisma.calculatorStatement.update({
      where: { id: entryId },
      data: { deletedAt: null },
    });

    res.json({
      id: updatedEntry.id,
      collectiveName: updatedEntry.collectiveName,
      amount: Number(updatedEntry.amount),
      method: updatedEntry.method,
      paidFor: updatedEntry.paidFor,
      deletedAt: updatedEntry.deletedAt,
      createdAt: updatedEntry.createdAt,
    });
  } catch (error) {
    console.error('Error restoring statement entry:', error);
    errorHandler(error as Error, req, res, () => {});
  }
});

export default router;

