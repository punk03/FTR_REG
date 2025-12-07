import { formatInTimeZone } from 'date-fns-tz';
import { Registration } from '../types';

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
 * Format time to HH:mm (Moscow timezone)
 */
export const formatTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, MOSCOW_TIMEZONE, 'HH:mm');
};

/**
 * Format currency (rubles, no decimals)
 */
export const formatCurrency = (amount: number): string => {
  return `${Math.round(amount)} ₽`;
};

/**
 * Формат отображаемого номера регистрации.
 * - Если есть blockNumber и number закодирован как blockNumber * 1000 + index,
 *   показываем в виде \"blockNumber.index\" (например, 29.1, 29.2).
 * - В остальных случаях показываем обычный номер или \"-\".
 */
export const formatRegistrationNumber = (reg: Partial<Registration> | any | null | undefined): string => {
  if (!reg || reg === null || reg === undefined) return '-';
  
  if (reg.blockNumber && reg.number) {
    const block = reg.blockNumber;
    const index = reg.number % 1000 || 0;
    if (index > 0) {
      return `${block}.${index}`;
    }
    return String(block);
  }

  if (reg.number) {
    return String(reg.number);
  }

  return '-';
};

