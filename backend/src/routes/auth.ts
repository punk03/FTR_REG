import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken, TokenPayload } from '../utils/jwt';
import { authenticateToken } from '../middleware/auth';
import { errorHandler } from '../middleware/errorHandler';
import { authRateLimiter } from '../middleware/rateLimit';

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/login
router.post(
  '/login',
  authRateLimiter,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('=== LOGIN REQUEST ===');
      console.log('Origin:', req.headers.origin);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Body:', { email: req.body.email, password: req.body.password ? '***' : 'missing' });
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Login validation errors:', errors.array());
        res.status(400).json({ error: 'Неверный формат данных', errors: errors.array() });
        return;
      }

      const { email, password } = req.body;
      console.log('Login attempt for email:', email);

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        console.error('User not found:', email);
        res.status(401).json({ error: 'Неверный email или пароль' });
        return;
      }

      console.log('User found, comparing password...');
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        console.error('Invalid password for user:', email);
        res.status(401).json({ error: 'Неверный email или пароль' });
        return;
      }

      console.log('Password valid, generating tokens...');

      const payload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          city: user.city,
          phone: user.phone,
        },
      });
      console.log('Login successful for user:', email);
    } catch (error) {
      console.error('Login error:', error);
      errorHandler(error as Error, req, res, () => {});
    }
  }
);

// POST /api/auth/refresh
router.post(
  '/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { refreshToken } = req.body;

      const payload = verifyRefreshToken(refreshToken);

      // Verify user still exists
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      const newPayload: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const newAccessToken = generateAccessToken(newPayload);
      const newRefreshToken = generateRefreshToken(newPayload);

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Получение информации о текущем пользователе
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Информация о пользователе
 *       401:
 *         description: Не авторизован
 */
// GET /api/auth/me
router.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        city: true,
        phone: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    errorHandler(error as Error, req, res, () => {});
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (_req: Request, res: Response): Promise<void> => {
  // Since tokens are stored in localStorage and don't expire automatically,
  // logout is mainly a client-side operation
  // In a more secure implementation, we could maintain a blacklist of tokens
  res.json({ message: 'Logged out successfully' });
});

export default router;

