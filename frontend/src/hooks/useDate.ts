import { useMemo } from 'react';
import { formatDate, formatDateTime } from '../utils/format';

export const useDateFormatter = () => {
  return useMemo(
    () => ({
      formatDate,
      formatDateTime,
    }),
    []
  );
};


