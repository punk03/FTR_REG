import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
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
  // Используем светлую тему для калькулятора (публичная страница) - мемоизируем
  const calculatorTheme = useMemo(() => createAppTheme(false), []);
  const isMobile = useMediaQuery(calculatorTheme.breakpoints.down('sm'));

  const [currentTab, setCurrentTab] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventData, setEventData] = useState<any>(null);
  
  // Состояния для основной вкладки калькулятора
  const [participantsCount, setParticipantsCount] = useState<number>(1);
  const [federationParticipantsCount, setFederationParticipantsCount] = useState<number>(0);
  const [selectedNominationId, setSelectedNominationId] = useState<number | ''>('');
  const [diplomasCount, setDiplomasCount] = useState<number>(0);
  const [medalsCount, setMedalsCount] = useState<number>(0);
  const [calculationResult, setCalculationResult] = useState<any>(null);

  // Состояния для вкладки списка номеров
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedRegistrations, setSelectedRegistrations] = useState<Set<number>>(new Set());
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [registrationEditData, setRegistrationEditData] = useState<Record<number, any>>({});
  const [customDiplomasCounts, setCustomDiplomasCounts] = useState<Record<number, number>>({});
  const [customMedalsCounts, setCustomMedalsCounts] = useState<Record<number, number>>({});
  const [combinedCalculationResult, setCombinedCalculationResult] = useState<any>(null);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Загрузка регистраций для вкладки списка номеров
  const fetchRegistrations = useCallback(async (searchQuery?: string): Promise<void> => {
    if (!token) {
      console.error('No token provided for fetching registrations');
      return Promise.resolve();
    }
    
    setRegistrationsLoading(true);
    setError(null); // Сбрасываем предыдущие ошибки
    try {
      const querySearch = searchQuery !== undefined ? searchQuery : search;
      console.log('Fetching registrations for token:', token, 'search:', querySearch);
      const params = querySearch && querySearch.trim() ? { search: querySearch.trim() } : {};
      const response = await axios.get(`${API_URL}/api/public/calculator/${token}/registrations`, { params });
      console.log('Registrations response:', response.data);
      const regs = response.data?.registrations || [];
      setRegistrations(regs);
      
      // Инициализация данных редактирования
      const initialEditData: Record<number, any> = {};
      regs.forEach((reg: any) => {
        initialEditData[reg.id] = {
          participantsCount: reg.participantsCount || 0,
          federationParticipantsCount: reg.federationParticipantsCount || 0,
          diplomasCount: reg.diplomasCount || 0,
          medalsCount: reg.medalsCount || 0,
          nominationId: reg.nominationId,
        };
      });
      setRegistrationEditData(initialEditData);
    } catch (err: any) {
      console.error('Error fetching registrations:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      const errorMessage = err.response?.data?.error || err.message || 'Не удалось загрузить список номеров';
      setError(errorMessage);
    } finally {
      setRegistrationsLoading(false);
    }
  }, [token, search]);
  
  // Очистка таймера при размонтировании
  useEffect(() => {
    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [searchDebounceTimer]);

  // Загрузка регистраций при переключении на вкладку списка номеров или изменении поиска
  useEffect(() => {
    if (currentTab === 1) {
      fetchRegistrations();
    }
  }, [currentTab, fetchRegistrations]);


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

  // Расчет объединённой оплаты
  const handleCalculateCombined = async () => {
    if (!token || selectedRegistrations.size === 0) {
      setError('Выберите хотя бы один номер');
      return;
    }

    try {
      // Подготавливаем кастомные данные участников из отредактированных данных
      const customParticipantsCounts: Record<number, number> = {};
      const customFederationParticipantsCounts: Record<number, number> = {};
      const customNominationIds: Record<number, number> = {};
      
      Array.from(selectedRegistrations).forEach((regId) => {
        const editData = registrationEditData[regId];
        if (editData) {
          if (editData.participantsCount !== undefined) {
            customParticipantsCounts[regId] = editData.participantsCount;
          }
          if (editData.federationParticipantsCount !== undefined) {
            customFederationParticipantsCounts[regId] = editData.federationParticipantsCount;
          }
          if (editData.nominationId !== undefined) {
            customNominationIds[regId] = editData.nominationId;
          }
        }
      });

      const response = await axios.post(`${API_URL}/api/public/calculator/${token}/calculate-combined`, {
        registrationIds: Array.from(selectedRegistrations),
        customDiplomasCounts,
        customMedalsCounts,
        customParticipantsCounts,
        customFederationParticipantsCounts,
        customNominationIds,
      });
      setCombinedCalculationResult(response.data);
    } catch (err: any) {
      console.error('Error calculating combined price:', err);
      setError(err.response?.data?.error || 'Ошибка при расчете объединённой оплаты');
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


  // Регистрации уже отфильтрованы на сервере, просто используем их
  const filteredRegistrations = useMemo(() => {
    return registrations;
  }, [registrations]);

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
      <Box
        sx={{
          '@media print': {
            '& .no-print': {
              display: 'none !important',
            },
            '& .print-only': {
              display: 'block !important',
            },
            '& button': {
              display: 'none !important',
            },
            '& .MuiTabs-root': {
              display: 'none !important',
            },
            '& .MuiTextField-root': {
              '& .MuiInputBase-input': {
                color: '#000 !important',
                WebkitTextFillColor: '#000 !important',
              },
            },
          },
        }}
      >
      <Container maxWidth={currentTab === 1 ? false : "md"} sx={{ py: { xs: 2, sm: 4 } }}>
      <Paper
        elevation={3}
        sx={{
          p: { xs: 2, sm: 4 },
          borderRadius: 2,
          backgroundColor: 'background.paper',
          color: 'text.primary',
          '@media print': {
            boxShadow: 'none',
            backgroundColor: 'white',
            color: 'black',
          },
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

            <Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)} sx={{ mb: 3 }} className="no-print">
              <Tab label="Калькулятор" />
              <Tab label="Список номеров" />
            </Tabs>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {/* Вкладка 1: Калькулятор */}
            {currentTab === 0 && (
              <Box>
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
              </Box>
            )}

            {/* Вкладка 2: Список номеров */}
            {currentTab === 1 && (
              <Box>
                {registrationsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }} className="no-print">
                      <Button
                        variant="outlined"
                        onClick={() => setCurrentTab(0)}
                        sx={{ minWidth: { xs: '100%', sm: 'auto' } }}
                      >
                        ← Вернуться к калькулятору
                      </Button>
                      <TextField
                        inputRef={searchInputRef}
                        fullWidth
                        size="small"
                        label="Поиск (по названию, коллективу, фамилии руководителя или тренера)"
                        value={search}
                        onChange={(e) => {
                          const newSearch = e.target.value;
                          setSearch(newSearch);
                          
                          // Очищаем предыдущий таймер
                          if (searchDebounceTimer) {
                            clearTimeout(searchDebounceTimer);
                          }
                          
                          // Устанавливаем новый таймер для debounce (500ms)
                          const timer = setTimeout(() => {
                            if (currentTab === 1) {
                              fetchRegistrations(newSearch);
                            }
                          }, 500);
                          
                          setSearchDebounceTimer(timer);
                        }}
                        onKeyDown={(e) => {
                          // Предотвращаем submit формы при нажатии Enter
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                        sx={{ maxWidth: { xs: '100%', sm: '400px' } }}
                      />
                      <Button
                        variant="contained"
                        onClick={handleCalculateCombined}
                        disabled={selectedRegistrations.size === 0}
                        sx={{ minWidth: { xs: '100%', sm: '200px' } }}
                      >
                        Рассчитать выбранные ({selectedRegistrations.size})
                      </Button>
                    </Box>

                    {filteredRegistrations.length === 0 ? (
                      <Alert severity="info">Номера не найдены</Alert>
                    ) : (
                      <Box className="no-print">
                        <TableContainer 
                          component={Paper} 
                          sx={{ 
                            width: '100%',
                            overflowX: 'auto',
                            maxHeight: '60vh', 
                            mb: 3 
                          }}
                        >
                          <Table stickyHeader size={isMobile ? 'small' : 'medium'} sx={{ minWidth: 800 }}>
                            <TableHead>
                              <TableRow>
                                <TableCell padding="checkbox" sx={{ backgroundColor: 'background.paper' }}>
                                  <Checkbox
                                    checked={selectedRegistrations.size === filteredRegistrations.length && filteredRegistrations.length > 0}
                                    indeterminate={selectedRegistrations.size > 0 && selectedRegistrations.size < filteredRegistrations.length}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedRegistrations(new Set(filteredRegistrations.map((r: any) => r.id)));
                                      } else {
                                        setSelectedRegistrations(new Set());
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell sx={{ backgroundColor: 'background.paper', fontWeight: 600 }}>Коллектив</TableCell>
                                <TableCell sx={{ backgroundColor: 'background.paper', fontWeight: 600 }}>Название номера</TableCell>
                                <TableCell sx={{ backgroundColor: 'background.paper', fontWeight: 600 }}>Дисциплина</TableCell>
                                <TableCell sx={{ backgroundColor: 'background.paper', fontWeight: 600 }}>Номинация</TableCell>
                                <TableCell sx={{ backgroundColor: 'background.paper', fontWeight: 600 }}>Участников</TableCell>
                                <TableCell sx={{ backgroundColor: 'background.paper', fontWeight: 600 }}>Фед. участников</TableCell>
                                <TableCell sx={{ backgroundColor: 'background.paper', fontWeight: 600 }}>Дипломы</TableCell>
                                <TableCell sx={{ backgroundColor: 'background.paper', fontWeight: 600 }}>Медали</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {filteredRegistrations.map((reg: any) => (
                                <TableRow key={reg.id} hover>
                                  <TableCell padding="checkbox">
                                    <Checkbox
                                      checked={selectedRegistrations.has(reg.id)}
                                      onChange={(e) => {
                                        const newSelected = new Set(selectedRegistrations);
                                        if (e.target.checked) {
                                          newSelected.add(reg.id);
                                        } else {
                                          newSelected.delete(reg.id);
                                        }
                                        setSelectedRegistrations(newSelected);
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>{reg.collective?.name || '-'}</TableCell>
                                  <TableCell>{reg.danceName || '-'}</TableCell>
                                  <TableCell>{reg.discipline?.name || '-'}</TableCell>
                                  <TableCell>
                                    <TextField
                                      size="small"
                                      value={getNominationByParticipants(registrationEditData[reg.id]?.participantsCount || reg.participantsCount || 0)}
                                      InputProps={{
                                        readOnly: true,
                                      }}
                                      sx={{ width: 120 }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={registrationEditData[reg.id]?.participantsCount ?? (reg.participantsCount || 0)}
                                      onChange={(e) => {
                                        const newCount = parseInt(e.target.value) || 0;
                                        const autoNomination = getNominationByParticipants(newCount);
                                        
                                        // Найти nominationId по названию из eventPrices
                                        let nominationId = registrationEditData[reg.id]?.nominationId || reg.nominationId;
                                        if (eventData?.eventPrices) {
                                          let foundNomination = eventData.eventPrices.find(
                                            (price: any) => price.nominationName === autoNomination
                                          );
                                          
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
                                            nominationId = foundNomination.nominationId;
                                          }
                                        }
                                        
                                        setRegistrationEditData({
                                          ...registrationEditData,
                                          [reg.id]: {
                                            ...registrationEditData[reg.id],
                                            participantsCount: newCount,
                                            nominationId,
                                          },
                                        });
                                      }}
                                      sx={{ width: 80 }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={registrationEditData[reg.id]?.federationParticipantsCount || 0}
                                      onChange={(e) => {
                                        setRegistrationEditData({
                                          ...registrationEditData,
                                          [reg.id]: {
                                            ...registrationEditData[reg.id],
                                            federationParticipantsCount: parseInt(e.target.value) || 0,
                                          },
                                        });
                                      }}
                                      sx={{ width: 80 }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={customDiplomasCounts[reg.id] !== undefined ? customDiplomasCounts[reg.id] : (registrationEditData[reg.id]?.diplomasCount || 0)}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        setCustomDiplomasCounts({
                                          ...customDiplomasCounts,
                                          [reg.id]: value,
                                        });
                                      }}
                                      sx={{ width: 80 }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={customMedalsCounts[reg.id] !== undefined ? customMedalsCounts[reg.id] : (registrationEditData[reg.id]?.medalsCount || 0)}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 0;
                                        setCustomMedalsCounts({
                                          ...customMedalsCounts,
                                          [reg.id]: value,
                                        });
                                      }}
                                      sx={{ width: 80 }}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Box>
                    )}

                    {combinedCalculationResult && (
                      <Card sx={{ backgroundColor: 'success.main', color: 'white', mt: 3 }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                              Итого к оплате
                            </Typography>
                            <Button
                              variant="contained"
                              onClick={() => {
                                window.print();
                              }}
                              sx={{
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                '&:hover': {
                                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                },
                              }}
                            >
                              Печать отчета
                            </Button>
                          </Box>
                          <Typography variant="h3" sx={{ fontWeight: 700, textAlign: 'center', mb: 3 }}>
                            {formatCurrency(combinedCalculationResult.totalPrice)}
                          </Typography>
                          <Divider sx={{ my: 2, backgroundColor: 'rgba(255, 255, 255, 0.3)' }} />
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                              <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                                  Выступление
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                  {formatCurrency(combinedCalculationResult.totalPerformancePrice)}
                                </Typography>
                              </Box>
                            </Grid>
                            {combinedCalculationResult.totalDiplomasPrice > 0 && (
                              <Grid item xs={12} sm={4}>
                                <Box sx={{ textAlign: 'center' }}>
                                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                                    Дипломы
                                  </Typography>
                                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    {formatCurrency(combinedCalculationResult.totalDiplomasPrice)}
                                  </Typography>
                                </Box>
                              </Grid>
                            )}
                            {combinedCalculationResult.totalMedalsPrice > 0 && (
                              <Grid item xs={12} sm={4}>
                                <Box sx={{ textAlign: 'center' }}>
                                  <Typography variant="body2" sx={{ opacity: 0.9, mb: 0.5 }}>
                                    Медали
                                  </Typography>
                                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    {formatCurrency(combinedCalculationResult.totalMedalsPrice)}
                                  </Typography>
                                </Box>
                              </Grid>
                            )}
                          </Grid>
                          {combinedCalculationResult.breakdown && combinedCalculationResult.breakdown.length > 0 && (
                            <Box sx={{ mt: 3 }}>
                              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                                Детализация по номерам:
                              </Typography>
                              {combinedCalculationResult.breakdown.map((item: any) => (
                                <Box key={item.registrationId} sx={{ mb: 2, p: 2, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 1 }}>
                                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                                    {item.danceName} ({item.collectiveName})
                                  </Typography>
                                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                    Выступление: {formatCurrency(item.performancePrice)}
                                  </Typography>
                                  {item.diplomasPrice > 0 && (
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                      Дипломы ({item.diplomasCount} шт.): {formatCurrency(item.diplomasPrice)}
                                    </Typography>
                                  )}
                                  {item.medalsPrice > 0 && (
                                    <Typography variant="body2" sx={{ opacity: 0.9 }}>
                                      Медали ({item.medalsCount} шт.): {formatCurrency(item.medalsPrice)}
                                    </Typography>
                                  )}
                                </Box>
                              ))}
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </Box>
            )}

            {/* Ссылка на меню внизу */}
            {currentTab === 0 && (
              <Box sx={{ mt: 4, textAlign: 'center' }} className="no-print">
                <Button
                  variant="text"
                  onClick={() => setCurrentTab(1)}
                  sx={{
                    color: 'primary.main',
                    textTransform: 'none',
                  }}
                >
                  Перейти к списку номеров →
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Container>
    </Box>
    </ThemeProvider>
  );
};

