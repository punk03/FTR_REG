import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { cacheService } from '../services/cacheService';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/reference/disciplines
router.get('/disciplines', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'reference:disciplines';
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      res.json(cached);
      return;
    }

    const disciplines = await prisma.discipline.findMany({
      orderBy: { name: 'asc' },
    });

    await cacheService.set(cacheKey, disciplines, 3600); // Cache for 1 hour
    res.json(disciplines);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/reference/nominations
router.get('/nominations', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'reference:nominations';
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      res.json(cached);
      return;
    }

    const nominations = await prisma.nomination.findMany({
      orderBy: { name: 'asc' },
    });

    await cacheService.set(cacheKey, nominations, 3600);
    res.json(nominations);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/reference/ages
router.get('/ages', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'reference:ages';
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      res.json(cached);
      return;
    }

    const ages = await prisma.age.findMany({
      orderBy: { name: 'asc' },
    });

    await cacheService.set(cacheKey, ages, 3600);
    res.json(ages);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/reference/categories
router.get('/categories', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const cacheKey = 'reference:categories';
    const cached = await cacheService.get(cacheKey);

    if (cached) {
      res.json(cached);
      return;
    }

    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    await cacheService.set(cacheKey, categories, 3600);
    res.json(categories);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/reference/events
router.get('/events', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;

    const where: { status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED' } = {};
    if (status && ['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(status)) {
      where.status = status as 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.json(events);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

export default router;


