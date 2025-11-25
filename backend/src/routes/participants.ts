import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/participants
router.get('/', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const participants = await prisma.participant.findMany({
      orderBy: { fullName: 'asc' },
    });

    // Format for select component
    const items: Record<number, string> = {};
    const optAttributes: Record<number, Record<string, string>> = {};

    for (const participant of participants) {
      const age = calculateAge(participant.birthDate);
      items[participant.id] = participant.fullName;
      optAttributes[participant.id] = {
        'data-subtext': `Возраст: ${age}, Дата рождения: ${participant.birthDate.toLocaleDateString('ru-RU')}`,
      };
    }

    res.json({ items, optAttributes });
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/participants
router.post(
  '/',
  authenticateToken,
  [
    body('fullName').notEmpty().withMessage('fullName is required'),
    body('birthDate').isISO8601().withMessage('Valid birthDate is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { fullName, birthDate } = req.body;

      const participant = await prisma.participant.create({
        data: {
          fullName,
          birthDate: new Date(birthDate),
          userId: req.user?.id,
        },
      });

      res.status(201).json(participant);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export default router;


