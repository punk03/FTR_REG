import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireRole } from '../middleware/auth';
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

// CRUD для дисциплин
// POST /api/reference/disciplines
router.post('/disciplines', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, abbreviations, variants } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const discipline = await prisma.discipline.create({
      data: {
        name,
        abbreviations: abbreviations ? JSON.stringify(abbreviations) : null,
        variants: variants ? JSON.stringify(variants) : null,
      },
    });

    await cacheService.del('reference:disciplines');
    res.json(discipline);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Discipline with this name already exists' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// PUT /api/reference/disciplines/:id
router.put('/disciplines/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name, abbreviations, variants } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    const discipline = await prisma.discipline.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(abbreviations !== undefined && { abbreviations: abbreviations ? JSON.stringify(abbreviations) : null }),
        ...(variants !== undefined && { variants: variants ? JSON.stringify(variants) : null }),
      },
    });

    await cacheService.del('reference:disciplines');
    res.json(discipline);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Discipline not found' });
    } else if (error.code === 'P2002') {
      res.status(400).json({ error: 'Discipline with this name already exists' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// DELETE /api/reference/disciplines/:id
router.delete('/disciplines/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    if (!id) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    // Проверяем, используется ли дисциплина в регистрациях
    const registrationsCount = await prisma.registration.count({
      where: { disciplineId: id },
    });

    if (registrationsCount > 0) {
      res.status(400).json({ error: `Cannot delete discipline: it is used in ${registrationsCount} registration(s)` });
      return;
    }

    await prisma.discipline.delete({
      where: { id },
    });

    await cacheService.del('reference:disciplines');
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Discipline not found' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// CRUD для номинаций
// POST /api/reference/nominations
router.post('/nominations', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const nomination = await prisma.nomination.create({
      data: { name },
    });

    await cacheService.del('reference:nominations');
    res.json(nomination);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Nomination with this name already exists' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// PUT /api/reference/nominations/:id
router.put('/nominations/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name } = req.body;

    if (!id || !name) {
      res.status(400).json({ error: 'ID and name are required' });
      return;
    }

    const nomination = await prisma.nomination.update({
      where: { id },
      data: { name },
    });

    await cacheService.del('reference:nominations');
    res.json(nomination);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Nomination not found' });
    } else if (error.code === 'P2002') {
      res.status(400).json({ error: 'Nomination with this name already exists' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// DELETE /api/reference/nominations/:id
router.delete('/nominations/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    if (!id) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    // Проверяем использование
    const registrationsCount = await prisma.registration.count({
      where: { nominationId: id },
    });

    if (registrationsCount > 0) {
      res.status(400).json({ error: `Cannot delete nomination: it is used in ${registrationsCount} registration(s)` });
      return;
    }

    await prisma.nomination.delete({
      where: { id },
    });

    await cacheService.del('reference:nominations');
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Nomination not found' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// CRUD для возрастов
// POST /api/reference/ages
router.post('/ages', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const age = await prisma.age.create({
      data: { name },
    });

    await cacheService.del('reference:ages');
    res.json(age);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Age with this name already exists' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// PUT /api/reference/ages/:id
router.put('/ages/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name } = req.body;

    if (!id || !name) {
      res.status(400).json({ error: 'ID and name are required' });
      return;
    }

    const age = await prisma.age.update({
      where: { id },
      data: { name },
    });

    await cacheService.del('reference:ages');
    res.json(age);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Age not found' });
    } else if (error.code === 'P2002') {
      res.status(400).json({ error: 'Age with this name already exists' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// DELETE /api/reference/ages/:id
router.delete('/ages/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    if (!id) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    // Проверяем использование
    const registrationsCount = await prisma.registration.count({
      where: { ageId: id },
    });

    if (registrationsCount > 0) {
      res.status(400).json({ error: `Cannot delete age: it is used in ${registrationsCount} registration(s)` });
      return;
    }

    await prisma.age.delete({
      where: { id },
    });

    await cacheService.del('reference:ages');
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Age not found' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// CRUD для категорий
// POST /api/reference/categories
router.post('/categories', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    
    if (!name) {
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    const category = await prisma.category.create({
      data: { name },
    });

    await cacheService.del('reference:categories');
    res.json(category);
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Category with this name already exists' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// PUT /api/reference/categories/:id
router.put('/categories/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { name } = req.body;

    if (!id || !name) {
      res.status(400).json({ error: 'ID and name are required' });
      return;
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name },
    });

    await cacheService.del('reference:categories');
    res.json(category);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Category not found' });
    } else if (error.code === 'P2002') {
      res.status(400).json({ error: 'Category with this name already exists' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

// DELETE /api/reference/categories/:id
router.delete('/categories/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    if (!id) {
      res.status(400).json({ error: 'Invalid ID' });
      return;
    }

    // Проверяем использование
    const registrationsCount = await prisma.registration.count({
      where: { categoryId: id },
    });

    if (registrationsCount > 0) {
      res.status(400).json({ error: `Cannot delete category: it is used in ${registrationsCount} registration(s)` });
      return;
    }

    await prisma.category.delete({
      where: { id },
    });

    await cacheService.del('reference:categories');
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Category not found' });
    } else {
      errorHandler(error as Error, req, res, () => {});
    }
  }
});

export default router;


