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
// CORS configuration - always include production IPs and domains
const productionOrigins = [
  'http://95.71.125.8:3000',
  'http://95.71.125.8',
  'http://ftr.lil-fil.netcraze.pro:8080',
  'http://ftr.lil-fil.netcraze.pro',
];

const developmentOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost'
];

// Always include production origins, merge with env if set
let corsOrigins: string[] = [...productionOrigins, ...developmentOrigins];

if (process.env.CORS_ORIGIN) {
  const envOrigins = process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(origin => origin.length > 0);
  // Always merge with production origins to ensure they're included
  corsOrigins = [...new Set([...productionOrigins, ...envOrigins, ...developmentOrigins])];
  console.log('CORS origins configured from env:', corsOrigins);
} else {
  console.log('CORS_ORIGIN not set, using defaults:', corsOrigins);
}

// Handle OPTIONS requests explicitly before CORS middleware
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  console.log('OPTIONS request from origin:', origin);
  
  // Check if origin is allowed
  const isAllowed = !origin || 
    productionOrigins.includes(origin) || 
    corsOrigins.includes(origin);
  
  if (isAllowed) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    return res.status(200).end();
  } else {
    console.warn('CORS blocked OPTIONS from origin:', origin);
    return res.status(403).json({ error: 'CORS blocked' });
  }
});

app.use(cors({
  origin: (origin, callback) => {
    try {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Always allow production IPs
      if (productionOrigins.includes(origin)) {
        console.log('CORS allowed (production):', origin);
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (corsOrigins.includes(origin)) {
        console.log('CORS allowed origin:', origin);
        return callback(null, true);
      } else {
        console.warn('CORS blocked origin:', origin);
        console.warn('Allowed origins:', corsOrigins);
        // Return false instead of error to avoid 500
        return callback(null, false);
      }
    } catch (error) {
      console.error('CORS origin check error:', error);
      // On error, allow the request to avoid breaking the app
      return callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 200
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

// Apply rate limiting to API routes, но пропускаем лёгкий расчёт цен,
// который может вызываться очень часто из интерфейса объединённой оплаты.
app.use('/api', (req, res, next) => {
  // Не ограничиваем /api/registrations/:id/calculate-price
  if (req.path.startsWith('/registrations/') && req.path.endsWith('/calculate-price')) {
    return next();
  }
  return apiRateLimiter(req, res, next);
});

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
  console.log(`CORS configured origins:`, corsOrigins);
  console.log(`CORS_ORIGIN env var:`, process.env.CORS_ORIGIN || 'not set');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default app;

