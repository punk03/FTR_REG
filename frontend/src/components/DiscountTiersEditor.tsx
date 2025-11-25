import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  IconButton,
  Typography,
  Paper,
  Grid,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
interface DiscountTier {
  minAmount: number;
  maxAmount: number;
  percentage: number;
}

// Структура соответствует формату в БД и paymentService: { minAmount, maxAmount, percentage }

interface DiscountTiersEditorProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: string;
}

export const DiscountTiersEditor: React.FC<DiscountTiersEditorProps> = ({
  value,
  onChange,
  error,
  helperText,
}) => {
  const [tiers, setTiers] = useState<DiscountTier[]>([]);
  const [validationError, setValidationError] = useState<string>('');

  useEffect(() => {
    try {
      const parsed = value ? JSON.parse(value) : [];
      if (Array.isArray(parsed)) {
        setTiers(parsed);
      } else {
        setTiers([]);
      }
    } catch (e) {
      setTiers([]);
    }
  }, [value]);

  const handleTierChange = (index: number, field: keyof DiscountTier, newValue: string) => {
    const newTiers = [...tiers];
    if (field === 'minAmount' || field === 'maxAmount' || field === 'percentage') {
      newTiers[index] = {
        ...newTiers[index],
        [field]: parseFloat(newValue) || 0,
      };
    }
    setTiers(newTiers);
    validateAndUpdate(newTiers);
  };

  const handleAddTier = () => {
    const maxMax = tiers.length > 0 ? Math.max(...tiers.map((t) => t.maxAmount)) : 0;
    const newTier: DiscountTier = {
      minAmount: maxMax + 1,
      maxAmount: maxMax + 10000,
      percentage: 0,
    };
    const newTiers = [...tiers, newTier];
    setTiers(newTiers);
    validateAndUpdate(newTiers);
  };

  const handleDeleteTier = (index: number) => {
    const newTiers = tiers.filter((_, i) => i !== index);
    setTiers(newTiers);
    validateAndUpdate(newTiers);
  };

  const validateAndUpdate = (tiersToValidate: DiscountTier[]) => {
    // Валидация
    if (tiersToValidate.length === 0) {
      setValidationError('');
      onChange(JSON.stringify([]));
      return;
    }

    // Проверка на перекрытие диапазонов
    const sorted = [...tiersToValidate].sort((a, b) => a.minAmount - b.minAmount);
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].maxAmount >= sorted[i + 1].minAmount) {
        setValidationError('Диапазоны не должны перекрываться');
        return;
      }
    }

    // Проверка minAmount <= maxAmount
    for (const tier of sorted) {
      if (tier.minAmount > tier.maxAmount) {
        setValidationError('Минимальное значение не может быть больше максимального');
        return;
      }
      if (tier.percentage < 0 || tier.percentage > 100) {
        setValidationError('Процент отката должен быть от 0 до 100');
        return;
      }
    }

    setValidationError('');
    onChange(JSON.stringify(sorted));
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Уровни откатов
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={handleAddTier}
          variant="outlined"
        >
          Добавить уровень
        </Button>
      </Box>

      {validationError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {validationError}
        </Alert>
      )}

      {tiers.length === 0 ? (
        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
          <Typography variant="body2" color="text.secondary">
            Нет уровней откатов. Нажмите "Добавить уровень" для создания.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tiers.map((tier, index) => (
            <Paper key={index} sx={{ p: 2 }}>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="От (мин. сумма)"
                    type="number"
                    value={tier.minAmount}
                    onChange={(e) => handleTierChange(index, 'minAmount', e.target.value)}
                    inputProps={{ min: 0 }}
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    fullWidth
                    size="small"
                    label="До (макс. сумма)"
                    type="number"
                    value={tier.maxAmount}
                    onChange={(e) => handleTierChange(index, 'maxAmount', e.target.value)}
                    inputProps={{ min: tier.minAmount }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Процент отката"
                    type="number"
                    value={tier.percentage}
                    onChange={(e) => handleTierChange(index, 'percentage', e.target.value)}
                    inputProps={{ min: 0, max: 100, step: 0.1 }}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <IconButton
                    color="error"
                    onClick={() => handleDeleteTier(index)}
                    disabled={tiers.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </Paper>
          ))}
        </Box>
      )}

      {helperText && (
        <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ mt: 1 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

