import { formatInTimeZone } from 'date-fns-tz';

const MOSCOW_TIMEZONE = 'Europe/Moscow';

/**
 * Format date to DD.MM.YYYY (Moscow timezone)
 */
export const formatDate = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, MOSCOW_TIMEZONE, 'dd.MM.yyyy');
};

/**
 * Format datetime to DD.MM.YYYY HH:mm (Moscow timezone)
 */
export const formatDateTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, MOSCOW_TIMEZONE, 'dd.MM.yyyy HH:mm');
};

/**
 * Format currency (rubles, no decimals)
 */
export const formatCurrency = (amount: number): string => {
  return `${Math.round(amount)} ₽`;
};

