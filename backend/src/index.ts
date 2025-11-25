import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import referenceRoutes from './routes/reference';
import eventsRoutes from './routes/events';
import eventPricesRoutes from './routes/eventPrices';
import suggestionsRoutes from './routes/suggestions';
import registrationsRoutes from './routes/registrations';
import participantsRoutes from './routes/participants';
import paymentsRoutes from './routes/payments';
import accountingRoutes from './routes/accounting';
import diplomasRoutes from './routes/diplomas';
import statisticsRoutes from './routes/statistics';
import adminRoutes from './routes/admin';
import excelImportRoutes from './routes/excelImport';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiRateLimiter } from './middleware/rateLimit';
import { cacheService } from './services/cacheService';
import { emailService } from './services/emailService';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
// Parse CORS_ORIGIN - can be comma-separated string or array
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://185.185.68.105:3000', 'http://185.185.68.105', 'http://localhost:3000', 'http://localhost:5173', 'http://localhost'];

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health checks
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Detailed health checks
app.get('/api/health', async (_req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
    },
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'ok';
  } catch (error) {
    health.services.database = 'error';
    health.status = 'degraded';
  }

  // Check Redis
  try {
    const redisConnected = cacheService.isConnected();
    health.services.redis = redisConnected ? 'ok' : 'disconnected';
    if (!redisConnected) {
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.redis = 'error';
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/api/health/db', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', service: 'database', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'error', service: 'database', error: (error as Error).message });
  }
});

app.get('/api/health/redis', async (_req, res) => {
  try {
    const connected = cacheService.isConnected();
    if (connected) {
      res.json({ status: 'ok', service: 'redis', timestamp: new Date().toISOString() });
    } else {
      res.status(503).json({ status: 'disconnected', service: 'redis' });
    }
  } catch (error) {
    res.status(503).json({ status: 'error', service: 'redis', error: (error as Error).message });
  }
});

// Apply rate limiting to all API routes
app.use('/api', apiRateLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/reference', referenceRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/events', eventPricesRoutes);
app.use('/api/suggestions', suggestionsRoutes);
app.use('/api/registrations', registrationsRoutes);
app.use('/api/participants', participantsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/diplomas', diplomasRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/excel-import', excelImportRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

// Initialize services
(async () => {
  // CacheService connects automatically in constructor
  await emailService.initialize();
})();

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;

