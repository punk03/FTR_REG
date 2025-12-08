import express, { Request, Response } from 'express';
import { query } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/suggestions/collectives?q=query
router.get(
  '/collectives',
  authenticateToken,
  [query('q').isLength({ min: 2 }).withMessage('Query must be at least 2 characters')],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = (req.query.q as string) || '';

      if (query.length < 2) {
        res.json([]);
        return;
      }

      // Using trigram search (pg_trgm extension)
      // Try to use similarity search, fallback to ILIKE if extension is not available
      let collectives: Array<{ id: number; name: string; accessory: string | null }>;
      try {
        // Check if pg_trgm extension is available
        await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
        
        collectives = await prisma.$queryRaw<Array<{ id: number; name: string; accessory: string | null }>>`
          SELECT id, name, accessory,
                 similarity(name, ${query}) as sim
          FROM collectives
          WHERE name % ${query} OR name ILIKE ${`%${query}%`}
          ORDER BY sim DESC, name ASC
          LIMIT 10
        `;
        
        // Remove similarity score from results (if present)
        collectives = collectives.map((item: any) => {
          const { sim, ...rest } = item;
          return rest;
        });
      } catch (error) {
        // Fallback to ILIKE if trigram is not available
        console.warn('pg_trgm extension not available, using ILIKE fallback');
        collectives = await prisma.$queryRaw<Array<{ id: number; name: string; accessory: string | null }>>`
          SELECT id, name, accessory
          FROM collectives
          WHERE name ILIKE ${`%${query}%`}
          ORDER BY name ASC
          LIMIT 10
        `;
      }

      res.json(collectives);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// GET /api/suggestions/persons?q=query&role=LEADER|TRAINER
router.get(
  '/persons',
  authenticateToken,
  [
    query('q').isLength({ min: 2 }).withMessage('Query must be at least 2 characters'),
    query('role').optional().isIn(['LEADER', 'TRAINER']).withMessage('Role must be LEADER or TRAINER'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const query = (req.query.q as string) || '';
      const role = req.query.role as 'LEADER' | 'TRAINER' | undefined;

      if (query.length < 2) {
        res.json([]);
        return;
      }

      // Using trigram search for persons
      let persons: Array<{ id: number; fullName: string; role: string; phone: string | null }>;
      try {
        // Check if pg_trgm extension is available
        await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
        
        let queryRaw = `
          SELECT id, "fullName", role, phone,
                 similarity("fullName", $1) as sim
          FROM persons
          WHERE "fullName" % $1 OR "fullName" ILIKE $2
        `;
        
        const params: any[] = [query, `%${query}%`];
        
        if (role) {
          queryRaw += ` AND role = $3`;
          params.push(role);
        }
        
        queryRaw += ` ORDER BY sim DESC, "fullName" ASC LIMIT 10`;
        
        const results = await prisma.$queryRawUnsafe<Array<{ id: number; fullName: string; role: string; phone: string | null; sim: number }>>(
          queryRaw,
          ...params
        );
        
        // Remove similarity score from results
        persons = results.map(({ sim, ...rest }: { sim: number; [key: string]: any }) => rest);
      } catch (error) {
        // Fallback to Prisma contains if trigram is not available
        console.warn('pg_trgm extension not available, using contains fallback');
        const where: any = {
          fullName: {
            contains: query,
            mode: 'insensitive',
          },
        };

        if (role) {
          where.role = role;
        }

        persons = await prisma.person.findMany({
          where,
          orderBy: { fullName: 'asc' },
          take: 10,
        });
      }

      res.json(persons);
    } catch (error) {
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

export default router;

