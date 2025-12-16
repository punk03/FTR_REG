import rateLimit from 'express-rate-limit';

// Rate limiter для авторизации
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // максимум 5 попыток входа
  message: 'Слишком много попыток входа. Попробуйте позже через 15 минут.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter для создания оплат
export const paymentRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 10, // максимум 10 запросов в минуту
  message: 'Слишком много запросов на создание оплат. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter для импорта Excel
export const importRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 3, // максимум 3 импорта за 5 минут
  message: 'Слишком много попыток импорта. Попробуйте позже через 5 минут.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter для общих API запросов
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 100, // максимум 100 запросов в минуту
  message: 'Слишком много запросов. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter для публичных endpoints калькулятора (более мягкий)
export const calculatorPublicRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 минута
  max: 200, // максимум 200 запросов в минуту (больше, так как публичный инструмент)
  message: 'Слишком много запросов к калькулятору. Попробуйте позже.',
  standardHeaders: true,
  legacyHeaders: false,
});


