import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
  ThemeProvider,
  CssBaseline,
} from '@mui/material';
import { createAppTheme } from '../theme';
import axios from 'axios';

// API URL - use environment variable or default to relative path
// @ts-ignore - Vite environment variable
const API_URL = import.meta.env?.VITE_API_URL || '';

// Функция для определения номинации по количеству участников
const getNominationByParticipants = (count: number): string => {
  if (count === 1) return 'Соло';
  if (count === 2) return 'Дуэт';
  if (count === 3) return 'Трио';
  if (count === 4) return 'Квартет';
  if (count === 5) return 'Квинтет';
  if (count >= 6 && count <= 12) return 'Малая форма';
  if (count >= 13 && count <= 24) return 'Продакшен';
  return 'Формейшен';
};

export const Calculator: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  // Используем светлую тему для калькулятора (публичная страница)
  const calculatorTheme = createAppTheme(false);
  const isMobile = useMediaQuery(calculatorTheme.breakpoints.down('sm'));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventData, setEventData] = useState<any>(null);
  
  const [participantsCount, setParticipantsCount] = useState<number>(1);
  const [federationParticipantsCount, setFederationParticipantsCount] = useState<number>(0);
  const [selectedNominationId, setSelectedNominationId] = useState<number | ''>('');
  const [diplomasCount, setDiplomasCount] = useState<number>(0);
  const [medalsCount, setMedalsCount] = useState<number>(0);

  const [calculationResult, setCalculationResult] = useState<any>(null);

  // Загрузка данных события
  useEffect(() => {
    const fetchEventData = async () => {
      if (!token) {
        setError('Токен не указан');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/api/public/calculator/${token}`);
        setEventData(response.data);
        
        // Автоматически определяем номинацию по количеству участников
        if (response.data.eventPrices && response.data.eventPrices.length > 0) {
          const autoNomination = getNominationByParticipants(participantsCount);
          const foundNomination = response.data.eventPrices.find(
            (price: any) => price.nominationName === autoNomination
          );
          if (foundNomination) {
            setSelectedNominationId(foundNomination.nominationId);
          } else {
            // Если не найдена автоматическая номинация, выбираем первую доступную
            setSelectedNominationId(response.data.eventPrices[0].nominationId);
          }
        }
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching event data:', err);
        setError(err.response?.data?.error || 'Не удалось загрузить данные события');
        setLoading(false);
      }
    };

    fetchEventData();
  }, [token]);

  // Автоматическое определение номинации при изменении количества участников
  useEffect(() => {
    if (eventData && eventData.eventPrices) {
      const autoNomination = getNominationByParticipants(participantsCount);
      const foundNomination = eventData.eventPrices.find(
        (price: any) => price.nominationName === autoNomination
      );
      if (foundNomination && !selectedNominationId) {
        setSelectedNominationId(foundNomination.nominationId);
      }
    }
  }, [participantsCount, eventData]);

  // Расчет стоимости
  const handleCalculate = async () => {
    if (!token || !selectedNominationId) {
      setError('Заполните все обязательные поля');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/api/public/calculator/${token}/calculate`, {
        participantsCount,
        federationParticipantsCount,
        nominationId: selectedNominationId,
        diplomasCount,
        medalsCount,
      });
      setCalculationResult(response.data);
    } catch (err: any) {
      console.error('Error calculating price:', err);
      setError(err.response?.data?.error || 'Ошибка при расчете стоимости');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <ThemeProvider theme={calculatorTheme}>
        <CssBaseline />
        <Container maxWidth="md" sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress />
        </Container>
      </ThemeProvider>
    );
  }

  if (error && !eventData) {
    return (
      <ThemeProvider theme={calculatorTheme}>
        <CssBaseline />
        <Container maxWidth="md" sx={{ mt: 4 }}>
          <Alert severity="error">{error}</Alert>
        </Container>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={calculatorTheme}>
      <CssBaseline />
      <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, sm: 4 },
          borderRadius: 2,
          backgroundColor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          sx={{
            fontWeight: 600,
            color: 'primary.main',
            mb: 3,
            textAlign: 'center',
            fontSize: { xs: '1.5rem', sm: '2rem' },
          }}
        >
          Калькулятор стоимости
        </Typography>

        {eventData && (
          <>
            <Card sx={{ mb: 3, backgroundColor: 'primary.light', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {eventData.name}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  {new Date(eventData.startDate).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}{' '}
                  -{' '}
                  {new Date(eventData.endDate).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Typography>
              </CardContent>
            </Card>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Количество участников"
                  type="number"
                  value={participantsCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setParticipantsCount(Math.max(1, value));
                  }}
                  inputProps={{ min: 1 }}
                  helperText={`Автоматически определена номинация: ${getNominationByParticipants(participantsCount)}`}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Федеральные участники"
                  type="number"
                  value={federationParticipantsCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setFederationParticipantsCount(Math.max(0, Math.min(value, participantsCount)));
                  }}
                  inputProps={{ min: 0, max: participantsCount }}
                  helperText={`Максимум: ${participantsCount}`}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Номинация</InputLabel>
                  <Select
                    value={selectedNominationId}
                    label="Номинация"
                    onChange={(e) => setSelectedNominationId(e.target.value as number)}
                  >
                    {eventData.eventPrices.map((price: any) => (
                      <MenuItem key={price.nominationId} value={price.nominationId}>
                        {price.nominationName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Количество дипломов"
                  type="number"
                  value={diplomasCount}
                  onChange={(e) => setDiplomasCount(Math.max(0, parseInt(e.target.value) || 0))}
                  inputProps={{ min: 0 }}
                  helperText={
                    eventData.pricePerDiploma
                      ? `Цена за диплом: ${formatCurrency(Number(eventData.pricePerDiploma))}`
                      : 'Дипломы не предусмотрены'
                  }
                  disabled={!eventData.pricePerDiploma}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Количество медалей"
                  type="number"
                  value={medalsCount}
                  onChange={(e) => setMedalsCount(Math.max(0, parseInt(e.target.value) || 0))}
                  inputProps={{ min: 0 }}
                  helperText={
                    eventData.pricePerMedal
                      ? `Цена за медаль: ${formatCurrency(Number(eventData.pricePerMedal))}`
                      : 'Медали не предусмотрены'
                  }
                  disabled={!eventData.pricePerMedal}
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={handleCalculate}
                  disabled={!selectedNominationId}
                  sx={{ py: 1.5, fontSize: '1.1rem', fontWeight: 600 }}
                >
                  Рассчитать стоимость
                </Button>
              </Grid>
            </Grid>

            {calculationResult && (
              <>
                <Divider sx={{ my: 4 }} />
                <Card
                  sx={{
                    backgroundColor: 'success.light',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(76, 175, 80, 0.3)',
                  }}
                >
                  <CardContent>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, textAlign: 'center' }}>
                      Итого: {formatCurrency(calculationResult.totalPrice)}
                    </Typography>

                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body1" sx={{ mb: 1, fontWeight: 500 }}>
                        Выступление: {formatCurrency(calculationResult.performancePrice)}
                      </Typography>
                      {calculationResult.breakdown.regularParticipants > 0 && (
                        <Typography variant="body2" sx={{ pl: 2, opacity: 0.9 }}>
                          Обычные участники ({calculationResult.breakdown.regularParticipants}):{' '}
                          {formatCurrency(calculationResult.breakdown.regularPrice)}
                        </Typography>
                      )}
                      {calculationResult.breakdown.federationParticipants > 0 && (
                        <Typography variant="body2" sx={{ pl: 2, opacity: 0.9 }}>
                          Федеральные участники ({calculationResult.breakdown.federationParticipants}):{' '}
                          {formatCurrency(calculationResult.breakdown.federationPrice)}
                        </Typography>
                      )}

                      {calculationResult.diplomasPrice > 0 && (
                        <Typography variant="body1" sx={{ mt: 2, fontWeight: 500 }}>
                          Дипломы ({calculationResult.breakdown.diplomasCount} шт.):{' '}
                          {formatCurrency(calculationResult.diplomasPrice)}
                        </Typography>
                      )}

                      {calculationResult.medalsPrice > 0 && (
                        <Typography variant="body1" sx={{ mt: 2, fontWeight: 500 }}>
                          Медали ({calculationResult.breakdown.medalsCount} шт.):{' '}
                          {formatCurrency(calculationResult.medalsPrice)}
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </Paper>
    </Container>
    </ThemeProvider>
  );
};

