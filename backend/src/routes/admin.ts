import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { auditLog } from '../middleware/auditLog';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/admin/users
router.get('/users', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        city: true,
        phone: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/admin/users
router.post(
  '/users',
  authenticateToken,
  requireRole('ADMIN'),
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['ADMIN', 'REGISTRATOR', 'ACCOUNTANT', 'STATISTICIAN']).withMessage('Valid role is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { name, email, password, role, city, phone } = req.body;

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role,
          city,
          phone,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          city: true,
          phone: true,
          createdAt: true,
        },
      });

      await auditLog(req, 'CREATE_USER', {
        action: 'CREATE_USER',
        entityType: 'User',
        entityId: user.id,
        newValue: user,
      });

      res.status(201).json(user);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// PUT /api/admin/users/:id
router.put(
  '/users/:id',
  authenticateToken,
  requireRole('ADMIN'),
  [
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['ADMIN', 'REGISTRATOR', 'ACCOUNTANT', 'STATISTICIAN']).withMessage('Valid role is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const id = parseInt(req.params.id);
      const oldUser = await prisma.user.findUnique({ where: { id } });

      if (!oldUser) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Check if trying to delete self
      if (req.user?.id === id && req.body.role && req.body.role !== oldUser.role) {
        res.status(400).json({ error: 'Cannot change your own role' });
        return;
      }

      // Check minimum ADMIN count
      if (oldUser.role === 'ADMIN' && req.body.role && req.body.role !== 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          res.status(400).json({ error: 'Cannot remove the last ADMIN user' });
          return;
        }
      }

      const updateData: any = {};
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.email !== undefined) updateData.email = req.body.email;
      if (req.body.password !== undefined) {
        updateData.password = await bcrypt.hash(req.body.password, 10);
      }
      if (req.body.role !== undefined) updateData.role = req.body.role;
      if (req.body.city !== undefined) updateData.city = req.body.city;
      if (req.body.phone !== undefined) updateData.phone = req.body.phone;

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          city: true,
          phone: true,
          createdAt: true,
        },
      });

      await auditLog(req, 'UPDATE_USER', {
        action: 'UPDATE_USER',
        entityType: 'User',
        entityId: user.id,
        oldValue: oldUser,
        newValue: user,
      });

      res.json(user);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// DELETE /api/admin/users/:id
router.delete('/users/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);

    // Cannot delete self
    if (req.user?.id === id) {
      res.status(400).json({ error: 'Cannot delete yourself' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check minimum ADMIN count
    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        res.status(400).json({ error: 'Cannot delete the last ADMIN user' });
        return;
      }
    }

    await prisma.user.delete({ where: { id } });

    await auditLog(req, 'DELETE_USER', {
      action: 'DELETE_USER',
      entityType: 'User',
      entityId: id,
      oldValue: user,
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/admin/collectives
router.get('/collectives', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const collectives = await prisma.collective.findMany({
      orderBy: { name: 'asc' },
    });

    res.json(collectives);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// DELETE /api/admin/collectives/:id
router.delete('/collectives/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.collective.delete({ where: { id } });
    res.json({ message: 'Collective deleted successfully' });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/admin/persons
router.get('/persons', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const persons = await prisma.person.findMany({
      orderBy: { fullName: 'asc' },
    });

    res.json(persons);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// DELETE /api/admin/persons/:id
router.delete('/persons/:id', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    await prisma.person.delete({ where: { id } });
    res.json({ message: 'Person deleted successfully' });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// GET /api/admin/settings
router.get('/settings', authenticateToken, requireRole('ADMIN'), async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });

    const result: Record<string, unknown> = {};
    for (const setting of settings) {
      try {
        result[setting.key] = JSON.parse(setting.value);
      } catch {
        result[setting.key] = setting.value;
      }
    }

    res.json(result);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// PUT /api/admin/settings/:key
router.put(
  '/settings/:key',
  authenticateToken,
  requireRole('ADMIN'),
  [body('value').notEmpty().withMessage('Value is required')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { key } = req.params;
      const { value, description } = req.body;

      let stringValue: string;
      if (typeof value === 'object' || Array.isArray(value)) {
        stringValue = JSON.stringify(value);
      } else if (typeof value === 'boolean') {
        stringValue = value ? 'true' : 'false';
      } else if (value === null) {
        stringValue = 'null';
      } else {
        stringValue = String(value);
      }

      const setting = await prisma.systemSetting.upsert({
        where: { key },
        update: {
          value: stringValue,
          description,
          updatedBy: req.user?.id,
        },
        create: {
          key,
          value: stringValue,
          description,
          updatedBy: req.user?.id,
        },
      });

      await auditLog(req, 'UPDATE_SETTING', {
        action: 'UPDATE_SETTING',
        entityType: 'SystemSetting',
        entityId: setting.id,
        newValue: { key, value },
      });

      res.json(setting);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

export default router;


