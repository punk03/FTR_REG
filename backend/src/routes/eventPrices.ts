import express, { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/events/:id/prices
router.get('/:id/prices', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const eventId = parseInt(req.params.id);

    const prices = await prisma.eventPrice.findMany({
      where: { eventId },
      include: {
        nomination: true,
      },
      orderBy: {
        nomination: {
          name: 'asc',
        },
      },
    });

    res.json(prices);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/events/:id/prices
router.post(
  '/:id/prices',
  authenticateToken,
  requireRole('ADMIN'),
  [
    body('nominationId').isInt().withMessage('Valid nominationId is required'),
    body('pricePerParticipant').isFloat({ min: 0 }).withMessage('Valid pricePerParticipant (>= 0) is required'),
    body('pricePerFederationParticipant').optional().isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const eventId = parseInt(req.params.id);
      const { nominationId, pricePerParticipant, pricePerFederationParticipant } = req.body;

      // Validate that price is positive integer (no decimals)
      if (pricePerParticipant % 1 !== 0) {
        res.status(400).json({ error: 'pricePerParticipant must be an integer (no decimals)' });
        return;
      }

      if (pricePerFederationParticipant && pricePerFederationParticipant % 1 !== 0) {
        res.status(400).json({ error: 'pricePerFederationParticipant must be an integer (no decimals)' });
        return;
      }

      const price = await prisma.eventPrice.upsert({
        where: {
          eventId_nominationId: {
            eventId,
            nominationId: parseInt(nominationId),
          },
        },
        update: {
          pricePerParticipant: parseFloat(pricePerParticipant),
          pricePerFederationParticipant: pricePerFederationParticipant ? parseFloat(pricePerFederationParticipant) : null,
        },
        create: {
          eventId,
          nominationId: parseInt(nominationId),
          pricePerParticipant: parseFloat(pricePerParticipant),
          pricePerFederationParticipant: pricePerFederationParticipant ? parseFloat(pricePerFederationParticipant) : null,
        },
        include: {
          nomination: true,
        },
      });

      res.status(201).json(price);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// PUT /api/events/:eventId/prices (bulk update)
router.put(
  '/:eventId/prices',
  authenticateToken,
  requireRole('ADMIN'),
  [
    body('prices').isArray().withMessage('prices must be an array'),
    body('prices.*.nominationId').isInt().withMessage('Valid nominationId is required'),
    body('prices.*.pricePerParticipant').isFloat({ min: 0 }).withMessage('Valid pricePerParticipant (>= 0) is required'),
    body('prices.*.pricePerFederationParticipant').optional().isFloat({ min: 0 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const eventId = parseInt(req.params.eventId);
      const { pricePerDiploma, pricePerMedal, prices } = req.body;

      // Update event prices for diplomas/medals if provided
      if (pricePerDiploma !== undefined || pricePerMedal !== undefined) {
        const updateData: any = {};
        if (pricePerDiploma !== undefined) {
          if (pricePerDiploma % 1 !== 0) {
            res.status(400).json({ error: 'pricePerDiploma must be an integer (no decimals)' });
            return;
          }
          updateData.pricePerDiploma = parseFloat(pricePerDiploma);
        }
        if (pricePerMedal !== undefined) {
          if (pricePerMedal % 1 !== 0) {
            res.status(400).json({ error: 'pricePerMedal must be an integer (no decimals)' });
            return;
          }
          updateData.pricePerMedal = parseFloat(pricePerMedal);
        }

        await prisma.event.update({
          where: { id: eventId },
          data: updateData,
        });
      }

      // Delete old prices
      await prisma.eventPrice.deleteMany({
        where: { eventId },
      });

      // Create new prices
      if (prices && Array.isArray(prices) && prices.length > 0) {
        // Validate all prices are integers
        for (const price of prices) {
          if (price.pricePerParticipant % 1 !== 0) {
            res.status(400).json({ error: 'All prices must be integers (no decimals)' });
            return;
          }
          if (price.pricePerFederationParticipant && price.pricePerFederationParticipant % 1 !== 0) {
            res.status(400).json({ error: 'All prices must be integers (no decimals)' });
            return;
          }
        }

        await prisma.eventPrice.createMany({
          data: prices.map((p: any) => ({
            eventId,
            nominationId: parseInt(p.nominationId),
            pricePerParticipant: parseFloat(p.pricePerParticipant),
            pricePerFederationParticipant: p.pricePerFederationParticipant ? parseFloat(p.pricePerFederationParticipant) : null,
          })),
        });
      }

      // Return updated prices
      const updatedPrices = await prisma.eventPrice.findMany({
        where: { eventId },
        include: {
          nomination: true,
        },
      });

      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: {
          pricePerDiploma: true,
          pricePerMedal: true,
        },
      });

      res.json({
        pricePerDiploma: event?.pricePerDiploma,
        pricePerMedal: event?.pricePerMedal,
        prices: updatedPrices,
      });
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

export default router;


