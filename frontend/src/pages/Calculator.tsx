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
  Card,
  CardContent,
  Divider,
  CircularProgress,
  Alert,
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
  if (count >= 3 && count <= 7) return 'Малая группа';
  if (count >= 8 && count <= 24) return 'Формейшен';
  if (count >= 25) return 'Продакшен';
  return 'Соло'; // По умолчанию
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
          
          // Ищем точное совпадение
          let foundNomination = response.data.eventPrices.find(
            (price: any) => price.nominationName === autoNomination
          );
          
          // Если точное совпадение не найдено, ищем похожие варианты
          if (!foundNomination) {
            const alternativeNames: { [key: string]: string[] } = {
              'Малая группа': ['Малая группа', 'Малая форма', 'Малая'],
              'Формейшен': ['Формейшен', 'Формейшн', 'Formation'],
              'Продакшен': ['Продакшен', 'Продакшн', 'Production'],
              'Соло': ['Соло', 'Solo'],
              'Дуэт': ['Дуэт', 'Duet'],
            };
            
            const alternatives = alternativeNames[autoNomination] || [autoNomination];
            foundNomination = response.data.eventPrices.find((price: any) =>
              alternatives.some(alt => price.nominationName.toLowerCase().includes(alt.toLowerCase()))
            );
          }
          
          if (foundNomination) {
            setSelectedNominationId(foundNomination.nominationId);
          } else if (response.data.eventPrices.length > 0) {
            // Если ничего не найдено, используем первую доступную номинацию
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
      
      // Ищем точное совпадение
      let foundNomination = eventData.eventPrices.find(
        (price: any) => price.nominationName === autoNomination
      );
      
      // Если точное совпадение не найдено, ищем похожие варианты
      if (!foundNomination) {
        const alternativeNames: { [key: string]: string[] } = {
          'Малая группа': ['Малая группа', 'Малая форма', 'Малая'],
          'Формейшен': ['Формейшен', 'Формейшн', 'Formation'],
          'Продакшен': ['Продакшен', 'Продакшн', 'Production'],
          'Соло': ['Соло', 'Solo'],
          'Дуэт': ['Дуэт', 'Duet'],
        };
        
        const alternatives = alternativeNames[autoNomination] || [autoNomination];
        foundNomination = eventData.eventPrices.find((price: any) =>
          alternatives.some(alt => price.nominationName.toLowerCase().includes(alt.toLowerCase()))
        );
      }
      
      if (foundNomination) {
        setSelectedNominationId(foundNomination.nominationId);
      } else if (eventData.eventPrices.length > 0) {
        // Если ничего не найдено, используем первую доступную номинацию
        setSelectedNominationId(eventData.eventPrices[0].nominationId);
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
                  helperText={`Номинация определяется автоматически: ${getNominationByParticipants(participantsCount)}`}
                  sx={{
                    '& .MuiInputBase-input': {
                      color: 'text.primary',
                    },
                    '& .MuiInputLabel-root': {
                      color: 'text.secondary',
                    },
                    '& .MuiFormHelperText-root': {
                      color: 'text.secondary',
                    },
                  }}
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
                <TextField
                  fullWidth
                  label="Номинация"
                  value={getNominationByParticipants(participantsCount)}
                  InputProps={{
                    readOnly: true,
                  }}
                  helperText="Определяется автоматически по количеству участников"
                  sx={{
                    '& .MuiInputBase-input': {
                      color: 'text.primary',
                      fontWeight: 500,
                    },
                    '& .MuiInputLabel-root': {
                      color: 'text.secondary',
                    },
                    '& .MuiFormHelperText-root': {
                      color: 'text.secondary',
                    },
                  }}
                />
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
                
                {/* Детальная информация о стоимости */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
                    Детальный расчет стоимости
                  </Typography>
                  
                  {/* Выступление */}
                  <Card sx={{ mb: 2, backgroundColor: 'primary.light', color: 'white' }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        Выступление: {formatCurrency(calculationResult.performancePrice)}
                      </Typography>
                      
                      <Box sx={{ pl: 2 }}>
                        {calculationResult.breakdown.regularParticipants > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="body2" sx={{ opacity: 0.95 }}>
                              Обычные участники: {calculationResult.breakdown.regularParticipants} чел. ×{' '}
                              {formatCurrency(
                                calculationResult.breakdown.regularPrice / calculationResult.breakdown.regularParticipants
                              )}{' '}
                              = {formatCurrency(calculationResult.breakdown.regularPrice)}
                            </Typography>
                          </Box>
                        )}
                        {calculationResult.breakdown.federationParticipants > 0 && (
                          <Box sx={{ mb: 1 }}>
                            <Typography variant="body2" sx={{ opacity: 0.95 }}>
                              Федеральные участники: {calculationResult.breakdown.federationParticipants} чел. ×{' '}
                              {formatCurrency(
                                calculationResult.breakdown.federationPrice / calculationResult.breakdown.federationParticipants
                              )}{' '}
                              = {formatCurrency(calculationResult.breakdown.federationPrice)}
                            </Typography>
                          </Box>
                        )}
                        <Typography variant="body2" sx={{ mt: 1, fontWeight: 500, opacity: 0.95 }}>
                          Номинация: {getNominationByParticipants(participantsCount)}
                        </Typography>
                        <Typography variant="body2" sx={{ opacity: 0.95 }}>
                          Всего участников: {participantsCount} чел.
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Дипломы */}
                  {calculationResult.diplomasPrice > 0 && (
                    <Card sx={{ mb: 2, backgroundColor: 'info.light', color: 'white' }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                          Дипломы: {formatCurrency(calculationResult.diplomasPrice)}
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          <Typography variant="body2" sx={{ opacity: 0.95 }}>
                            Количество: {calculationResult.breakdown.diplomasCount} шт. ×{' '}
                            {formatCurrency(calculationResult.breakdown.pricePerDiploma || 0)} ={' '}
                            {formatCurrency(calculationResult.diplomasPrice)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  )}

                  {/* Медали */}
                  {calculationResult.medalsPrice > 0 && (
                    <Card sx={{ mb: 2, backgroundColor: 'warning.light', color: 'white' }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                          Медали: {formatCurrency(calculationResult.medalsPrice)}
                        </Typography>
                        <Box sx={{ pl: 2 }}>
                          <Typography variant="body2" sx={{ opacity: 0.95 }}>
                            Количество: {calculationResult.breakdown.medalsCount} шт. ×{' '}
                            {formatCurrency(calculationResult.breakdown.pricePerMedal || 0)} ={' '}
                            {formatCurrency(calculationResult.medalsPrice)}
                          </Typography>
                        </Box>
                      </CardContent>
                    </Card>
                  )}
                </Box>

                {/* Итоговая сумма */}
                <Card
                  sx={{
                    backgroundColor: 'success.main',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(76, 175, 80, 0.4)',
                  }}
                >
                  <CardContent>
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, textAlign: 'center' }}>
                      Итого к оплате
                    </Typography>
                    <Typography variant="h3" sx={{ fontWeight: 700, textAlign: 'center', color: 'white' }}>
                      {formatCurrency(calculationResult.totalPrice)}
                    </Typography>
                    
                    <Divider sx={{ my: 2, backgroundColor: 'rgba(255, 255, 255, 0.3)' }} />
                    
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                      <Grid item xs={12} sm={4}>
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                            Выступление
                          </Typography>
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {formatCurrency(calculationResult.performancePrice)}
                          </Typography>
                        </Box>
                      </Grid>
                      {calculationResult.diplomasPrice > 0 && (
                        <Grid item xs={12} sm={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                              Дипломы
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {formatCurrency(calculationResult.diplomasPrice)}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                      {calculationResult.medalsPrice > 0 && (
                        <Grid item xs={12} sm={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                              Медали
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {formatCurrency(calculationResult.medalsPrice)}
                            </Typography>
                          </Box>
                        </Grid>
                      )}
                    </Grid>
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

