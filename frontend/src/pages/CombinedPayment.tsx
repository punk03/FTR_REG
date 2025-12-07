import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  TextField,
  Button,
  Grid,
  FormControlLabel,
  CircularProgress,
  Alert,
  Divider,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  IconButton,
  InputAdornment,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CalculateIcon from '@mui/icons-material/Calculate';
import api from '../services/api';
import { Event } from '../types';
import { formatCurrency, formatRegistrationNumber } from '../utils/format';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';

type StepType = 'select' | 'edit';

// Функция для подсчета количества строк с русскими символами
const countRussianLines = (text: string): number => {
  if (!text) return 0;
  const lines = text.split('\n').filter((line) => line.trim());
  // Проверяем, содержит ли строка хотя бы один русский символ
  const russianRegex = /[А-Яа-яЁё]/;
  return lines.filter((line) => russianRegex.test(line)).length;
};

export const CombinedPayment: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedRegistrations, setSelectedRegistrations] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [currentStep, setCurrentStep] = useState<StepType>('select');
  const [paymentGroupName, setPaymentGroupName] = useState('');
  const [paymentsByMethod, setPaymentsByMethod] = useState({
    cash: '',
    card: '',
    transfer: '',
  });
  const [payingPerformance, setPayingPerformance] = useState(true);
  const [payingDiplomasAndMedals, setPayingDiplomasAndMedals] = useState(false);
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [registrationData, setRegistrationData] = useState<Record<number, any>>({});
  const [priceCalculation, setPriceCalculation] = useState<any>(null);
  const [registrationPrices, setRegistrationPrices] = useState<Record<number, any>>({});
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await api.get('/api/reference/events?status=ACTIVE');
        setEvents(response.data);
        if (response.data.length > 0 && !selectedEventId) {
          setSelectedEventId(response.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
      }
    };
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchRegistrations();
    }
  }, [selectedEventId]);

  // Сброс расчётов при переходе на шаг выбора
  useEffect(() => {
    if (currentStep !== 'edit') {
      setPriceCalculation(null);
      setRegistrationPrices({});
    }
  }, [currentStep]);

  // Автоматический пересчёт при изменении данных (с дебаунсом),
  // чтобы суммы обновлялись "на лету" во время редактирования
  useEffect(() => {
    if (currentStep !== 'edit' || selectedRegistrations.size === 0) {
      return;
    }

    const timeout = setTimeout(() => {
      calculateTotalPrice();
      calculateIndividualPrices();
    }, 400);

    return () => clearTimeout(timeout);
  }, [currentStep, selectedRegistrations, registrationData, payingPerformance, payingDiplomasAndMedals, applyDiscount]);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/registrations', {
        params: { eventId: selectedEventId, limit: 1000 },
      });
      const regs = response.data.registrations || [];
      setRegistrations(regs);

      // Инициализация данных регистраций
      const initialData: Record<number, any> = {};
      regs.forEach((reg: any) => {
        initialData[reg.id] = {
          participantsCount: reg.participantsCount,
          federationParticipantsCount: reg.federationParticipantsCount,
          medalsCount: reg.medalsCount,
          diplomasList: reg.diplomasList || '',
          diplomasCount: reg.diplomasCount,
        };
      });
      setRegistrationData(initialData);
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Расчет стоимости для каждого номера отдельно
  const calculateIndividualPrices = async (): Promise<void> => {
    if (selectedRegistrations.size === 0) return;

    const prices: Record<number, any> = {};

    for (const regId of selectedRegistrations) {
      const reg = registrations.find((r) => r.id === regId);
      if (!reg) continue;

      const data = registrationData[regId] || {};
      const diplomasList = data.diplomasList || reg.diplomasList || '';
      const baseDiplomasCount = data.diplomasCount ?? reg.diplomasCount ?? 0;
      let diplomasCount = countRussianLines(diplomasList);
      // Если при редактировании временно получилось 0, но ранее уже было количество дипломов — не обнуляем сумму
      if (diplomasCount === 0 && baseDiplomasCount > 0) {
        diplomasCount = baseDiplomasCount;
      }

      try {
        const response = await api.get(`/api/registrations/${regId}/calculate-price`, {
          params: {
            participantsCount: data.participantsCount || reg.participantsCount,
            federationParticipantsCount: data.federationParticipantsCount || reg.federationParticipantsCount,
            diplomasCount,
            medalsCount: data.medalsCount || reg.medalsCount,
          },
        });

        prices[regId] = {
          performancePrice: response.data.performancePrice || 0,
          diplomasPrice: response.data.details?.diplomasPrice || 0,
          medalsPrice: response.data.details?.medalsPrice || 0,
          total: response.data.total || 0,
        };
      } catch (error) {
        console.error(`Error calculating price for registration ${regId}:`, error);
        // Не перетираем предыдущие значения нулями, просто логируем ошибку
      }
    }

    // Мягко обновляем только те заявки, для которых расчёт прошёл успешно
    setRegistrationPrices((prev) => {
      const updated = { ...prev };
      Object.entries(prices).forEach(([id, value]) => {
        updated[Number(id)] = value;
      });
      return updated;
    });
  };

  const calculateTotalPrice = async (): Promise<void> => {
    if (selectedRegistrations.size === 0) return;

    try {
      const selectedRegs = registrations.filter((r) => selectedRegistrations.has(r.id));
      let totalPerformance = 0;
      let totalDiplomas = 0;

      for (const reg of selectedRegs) {
        const data = registrationData[reg.id] || {};
        const diplomasList = data.diplomasList || reg.diplomasList || '';
        const baseDiplomasCount = data.diplomasCount ?? reg.diplomasCount ?? 0;
        let diplomasCount = countRussianLines(diplomasList);
        if (diplomasCount === 0 && baseDiplomasCount > 0) {
          diplomasCount = baseDiplomasCount;
        }
        
        const response = await api.get(`/api/registrations/${reg.id}/calculate-price`, {
          params: {
            participantsCount: data.participantsCount || reg.participantsCount,
            federationParticipantsCount: data.federationParticipantsCount || reg.federationParticipantsCount,
            diplomasCount,
            medalsCount: data.medalsCount || reg.medalsCount,
          },
        });

        if (payingPerformance) {
          totalPerformance += response.data.performancePrice || (response.data.total - response.data.diplomasAndMedalsPrice);
        }
        if (payingDiplomasAndMedals) {
          totalDiplomas += response.data.diplomasAndMedalsPrice;
        }
      }

      let discount = 0;
      if (applyDiscount && payingPerformance) {
        const event = events.find((e) => e.id === selectedEventId);
        if (event?.discountTiers) {
          try {
            const tiers = JSON.parse(event.discountTiers);
            const tier = tiers.find((t: any) => totalPerformance >= t.min && totalPerformance <= t.max);
            if (tier) {
              discount = (totalPerformance * tier.discountPercent) / 100;
            }
          } catch (e) {
            console.error('Error parsing discount tiers:', e);
          }
        }
      }

      const total = totalPerformance + totalDiplomas - discount;
      setPriceCalculation({
        performance: totalPerformance,
        diplomas: totalDiplomas,
        discount,
        total,
      });
    } catch (error) {
      console.error('Error calculating price:', error);
      showError('Ошибка при расчёте итоговой суммы');
    }
  };

  // Функция для ручного пересчёта цен
  const handleRecalculate = async () => {
    if (selectedRegistrations.size === 0) {
      showError('Выберите хотя бы одну регистрацию');
      return;
    }

    setIsRecalculating(true);
    try {
      await Promise.all([
        calculateIndividualPrices(),
        calculateTotalPrice(),
      ]);
      showSuccess('Пересчёт выполнен успешно');
    } catch (error) {
      console.error('Error recalculating prices:', error);
      showError('Ошибка при пересчёте цен');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleToggleRegistration = (id: number) => {
    const newSelected = new Set(selectedRegistrations);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRegistrations(newSelected);
  };

  const handleSelectAll = () => {
    // Выбираем только отфильтрованные заявки
    const filteredIds = filteredRegistrations.map((r) => r.id);
    const allFilteredSelected = filteredIds.every((id) => selectedRegistrations.has(id));
    
    if (allFilteredSelected) {
      // Снимаем выбор со всех отфильтрованных
      const newSelected = new Set(selectedRegistrations);
      filteredIds.forEach((id) => newSelected.delete(id));
      setSelectedRegistrations(newSelected);
    } else {
      // Выбираем все отфильтрованные
      const newSelected = new Set(selectedRegistrations);
      filteredIds.forEach((id) => newSelected.add(id));
      setSelectedRegistrations(newSelected);
    }
  };

  const handleNext = () => {
    if (selectedRegistrations.size === 0) {
      showError('Выберите хотя бы одну регистрацию');
      return;
    }
    setCurrentStep('edit');
  };

  const handleBack = () => {
    setCurrentStep('select');
  };

  // Обработка изменения количества участников с автоматической корректировкой
  const handleParticipantsChange = (regId: number, value: string, isFederation: boolean) => {
    const reg = registrations.find((r) => r.id === regId);
    if (!reg) return;

    const data = registrationData[regId] || {};
    const currentTotal = parseInt(data.participantsCount || reg.participantsCount) || 0;
    const currentFederation = parseInt(data.federationParticipantsCount || reg.federationParticipantsCount) || 0;
    const newValue = parseInt(value) || 0;

    if (isFederation) {
      // При изменении федеральных участников
      const newFederation = Math.max(0, Math.min(newValue, currentTotal));
      const newRegular = Math.max(0, currentTotal - newFederation);
      
      setRegistrationData({
        ...registrationData,
        [regId]: {
          ...data,
          participantsCount: newRegular + newFederation,
          federationParticipantsCount: newFederation,
        },
      });
    } else {
      // При изменении общего количества участников
      const newTotal = Math.max(newValue, currentFederation);
      const newRegular = newTotal - currentFederation;
      
      setRegistrationData({
        ...registrationData,
        [regId]: {
          ...data,
          participantsCount: newTotal,
          federationParticipantsCount: currentFederation,
        },
      });
    }
  };

  // Заполнение поля способа оплаты всей суммой
  const fillPaymentMethod = (method: 'cash' | 'card' | 'transfer') => {
    if (!priceCalculation) return;
    
    setPaymentsByMethod({
      cash: method === 'cash' ? priceCalculation.total.toFixed(2) : '',
      card: method === 'card' ? priceCalculation.total.toFixed(2) : '',
      transfer: method === 'transfer' ? priceCalculation.total.toFixed(2) : '',
    });
  };

  const handleSave = async () => {
    if (selectedRegistrations.size === 0) {
      showError('Выберите хотя бы одну регистрацию');
      return;
    }

    const totalPaid = parseFloat(paymentsByMethod.cash || '0') +
      parseFloat(paymentsByMethod.card || '0') +
      parseFloat(paymentsByMethod.transfer || '0');

    if (!priceCalculation || Math.abs(totalPaid - priceCalculation.total) > 1) {
      showError(`Сумма оплаты (${formatCurrency(totalPaid)}) не совпадает с требуемой (${formatCurrency(priceCalculation?.total || 0)})`);
      return;
    }

    setSaving(true);
    try {
      const registrationsData = Array.from(selectedRegistrations).map((id) => {
        const reg = registrations.find((r) => r.id === id);
        const data = registrationData[id] || {};
        const diplomasList = data.diplomasList || reg?.diplomasList || '';
        const baseDiplomasCount = data.diplomasCount ?? reg?.diplomasCount ?? 0;
        let diplomasCount = countRussianLines(diplomasList);
        if (diplomasCount === 0 && baseDiplomasCount > 0) {
          diplomasCount = baseDiplomasCount;
        }
        
        return {
          registrationId: id,
          participantsCount: parseInt(data.participantsCount || reg?.participantsCount || 0),
          federationParticipantsCount: parseInt(data.federationParticipantsCount || reg?.federationParticipantsCount || 0),
          medalsCount: parseInt(data.medalsCount || reg?.medalsCount || 0),
          diplomasCount,
          diplomasList: diplomasList || '', // Всегда передаём diplomasList, даже если пустой
        };
      });

      await api.post('/api/payments/create', {
        registrationIds: Array.from(selectedRegistrations),
        paymentsByMethod: {
          cash: parseFloat(paymentsByMethod.cash || '0'),
          card: parseFloat(paymentsByMethod.card || '0'),
          transfer: parseFloat(paymentsByMethod.transfer || '0'),
        },
        payingPerformance,
        payingDiplomasAndMedals,
        applyDiscount: applyDiscount && payingPerformance,
        paymentGroupName: paymentGroupName || undefined,
        registrationsData,
      });

      showSuccess('Оплата успешно создана');
      setSelectedRegistrations(new Set());
      setPaymentGroupName('');
      setPaymentsByMethod({ cash: '', card: '', transfer: '' });
      setCurrentStep('select');
      fetchRegistrations();
    } catch (error: any) {
      console.error('Error creating payment:', error);
      showError(error.response?.data?.error || 'Ошибка создания оплаты');
    } finally {
      setSaving(false);
    }
  };

  const filteredRegistrations = registrations.filter((reg) => {
    if (search) {
      const searchLower = search.toLowerCase();
      const leaders = reg.leaders?.map((l: any) => l.person?.fullName).filter(Boolean).join(', ') || '';
      const trainers = reg.trainers?.map((t: any) => t.person?.fullName).filter(Boolean).join(', ') || '';
      const diplomasList = reg.diplomasList || '';
      const diplomasCount = countRussianLines(diplomasList);
      
      return (
        reg.collective?.name?.toLowerCase().includes(searchLower) ||
        reg.danceName?.toLowerCase().includes(searchLower) ||
        reg.discipline?.name?.toLowerCase().includes(searchLower) ||
        reg.nomination?.name?.toLowerCase().includes(searchLower) ||
        reg.age?.name?.toLowerCase().includes(searchLower) ||
        reg.category?.name?.toLowerCase().includes(searchLower) ||
        leaders.toLowerCase().includes(searchLower) ||
        trainers.toLowerCase().includes(searchLower) ||
        String(reg.participantsCount || '').includes(searchLower) ||
        String(reg.federationParticipantsCount || '').includes(searchLower) ||
        String(diplomasCount || '').includes(searchLower) ||
        String(reg.medalsCount || '').includes(searchLower) ||
        diplomasList.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const selectedRegistrationsList = registrations.filter((r) => selectedRegistrations.has(r.id));

  const renderSelectStep = () => (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Событие</InputLabel>
          <Select
            value={selectedEventId}
            label="Событие"
            onChange={(e) => {
              setSelectedEventId(e.target.value as number);
              setSelectedRegistrations(new Set());
            }}
          >
            {events.map((event) => (
              <MenuItem key={event.id} value={event.id}>
                {event.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 2 }}>
          {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => navigate('/accounting')}
            >
              Добавить платеж
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={selectedRegistrations.size === 0}
            endIcon={<ArrowForwardIcon />}
          >
            Перейти к оплате ({selectedRegistrations.size})
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Выберите заявки для оплаты</Typography>
          {search && (
            <Button size="small" onClick={handleSelectAll}>
              {filteredRegistrations.every((r) => selectedRegistrations.has(r.id)) 
                ? 'Снять все' 
                : 'Выбрать все'}
            </Button>
          )}
        </Box>

        <TextField
          fullWidth
          placeholder="Поиск по коллективу, названию номера..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ mb: 2 }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Коллектив</TableCell>
                  <TableCell>Название номера</TableCell>
                  <TableCell>Руководители</TableCell>
                  <TableCell>Тренеры</TableCell>
                  <TableCell>Участников</TableCell>
                  <TableCell>Дипломов</TableCell>
                  <TableCell>Медалей</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRegistrations.map((reg) => {
                  const isSelected = selectedRegistrations.has(reg.id);
                  const leaders = reg.leaders?.map((l: any) => l.person?.fullName).filter(Boolean).join(', ') || '-';
                  const trainers = reg.trainers?.map((t: any) => t.person?.fullName).filter(Boolean).join(', ') || '-';
                  const diplomasList = reg.diplomasList || '';
                  const diplomasCount = countRussianLines(diplomasList);

                  return (
                    <TableRow key={reg.id} selected={isSelected}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => handleToggleRegistration(reg.id)}
                        />
                      </TableCell>
                      <TableCell>
                        №{formatRegistrationNumber(reg)} — {reg.collective?.name || '-'}
                      </TableCell>
                      <TableCell>{reg.danceName || '-'}</TableCell>
                      <TableCell>{leaders}</TableCell>
                      <TableCell>{trainers}</TableCell>
                      <TableCell>{reg.participantsCount}</TableCell>
                      <TableCell>{diplomasCount}</TableCell>
                      <TableCell>{reg.medalsCount || 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </>
  );

  const renderEditStep = () => (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          Назад к выбору
        </Button>
        <Typography variant="h6">
          Редактирование и оплата ({selectedRegistrations.size} заявок)
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Выбранные заявки
            </Typography>
            {selectedRegistrationsList.map((reg) => {
              const data = registrationData[reg.id] || {};
              const leaders = reg.leaders?.map((l: any) => l.person?.fullName).filter(Boolean).join(', ') || '-';
              const trainers = reg.trainers?.map((t: any) => t.person?.fullName).filter(Boolean).join(', ') || '-';
              const diplomasList = data.diplomasList || reg.diplomasList || '';
              const diplomasCount = countRussianLines(diplomasList);
              const prices = registrationPrices[reg.id] || { performancePrice: 0, diplomasPrice: 0, medalsPrice: 0, total: 0 };
              const currentTotal = parseInt(data.participantsCount || reg.participantsCount) || 0;
              const currentFederation = parseInt(data.federationParticipantsCount || reg.federationParticipantsCount) || 0;
              const currentRegular = currentTotal - currentFederation;

              return (
                <Card key={reg.id} sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      {reg.danceName || 'Без названия'}
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Руководители: {leaders}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Тренеры: {trainers}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Дисциплина: {reg.discipline?.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Номинация: {reg.nomination?.name}
                        </Typography>
                      </Grid>
                    </Grid>
                    <Divider sx={{ my: 2 }} />
                    <Grid container spacing={2}>
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth
                          label="Участников"
                          type="number"
                          size="small"
                          value={currentTotal}
                          onChange={(e) => handleParticipantsChange(reg.id, e.target.value, false)}
                          inputProps={{ min: currentFederation }}
                          helperText={`Обычных: ${currentRegular}`}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth
                          label="Участников федерации"
                          type="number"
                          size="small"
                          value={currentFederation}
                          onChange={(e) => handleParticipantsChange(reg.id, e.target.value, true)}
                          inputProps={{ min: 0, max: currentTotal }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth
                          label="Медалей"
                          type="number"
                          size="small"
                          value={data.medalsCount || reg.medalsCount}
                          onChange={(e) => {
                            setRegistrationData({
                              ...registrationData,
                              [reg.id]: {
                                ...data,
                                medalsCount: e.target.value,
                              },
                            });
                          }}
                          inputProps={{ min: 0 }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth
                          label={`Дипломов (${diplomasCount})`}
                          type="text"
                          size="small"
                          value={diplomasCount}
                          InputProps={{
                            readOnly: true,
                          }}
                          helperText="Количество считается автоматически"
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="ФИО на дипломы (каждое на новой строке)"
                          multiline
                          rows={3}
                          value={diplomasList}
                          onChange={(e) => {
                            setRegistrationData({
                              ...registrationData,
                              [reg.id]: {
                                ...data,
                                diplomasList: e.target.value,
                              },
                            });
                          }}
                          helperText={`Строк с русскими символами: ${diplomasCount}`}
                        />
                      </Grid>
                    </Grid>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Стоимость за номер: <strong>{formatCurrency(prices.performancePrice)}</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Дипломы: <strong>{formatCurrency(prices.diplomasPrice)}</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Медали: <strong>{formatCurrency(prices.medalsPrice)}</strong>
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 1 }}>
                        Итого за номер: <strong>{formatCurrency(prices.total)}</strong>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Оплата
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  checked={payingPerformance}
                  onChange={(e) => setPayingPerformance(e.target.checked)}
                />
              }
              label="Оплатить выступления"
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={payingDiplomasAndMedals}
                  onChange={(e) => setPayingDiplomasAndMedals(e.target.checked)}
                />
              }
              label="Оплатить дипломы и медали"
            />

            {payingPerformance && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={applyDiscount}
                    onChange={(e) => setApplyDiscount(e.target.checked)}
                  />
                }
                label="Применить откат"
              />
            )}

            <TextField
              fullWidth
              label="Название группы платежей"
              value={paymentGroupName}
              onChange={(e) => setPaymentGroupName(e.target.value)}
              sx={{ mt: 2 }}
            />

            <Divider sx={{ my: 2 }} />

            <Button
              fullWidth
              variant="outlined"
              startIcon={isRecalculating ? <CircularProgress size={20} /> : <CalculateIcon />}
              onClick={handleRecalculate}
              disabled={isRecalculating || selectedRegistrations.size === 0}
              sx={{ mb: 2 }}
            >
              {isRecalculating ? 'Пересчёт...' : 'Сделать перерасчёт'}
            </Button>

            {priceCalculation && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Выступления: {formatCurrency(priceCalculation.performance)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Дипломы/медали: {formatCurrency(priceCalculation.diplomas)}
                </Typography>
                {priceCalculation.discount > 0 && (
                  <Typography variant="body2" color="error">
                    Откат: -{formatCurrency(priceCalculation.discount)}
                  </Typography>
                )}
                <Typography variant="h6" sx={{ mt: 1 }}>
                  Итого: {formatCurrency(priceCalculation.total)}
                </Typography>
              </Box>
            )}

            {!priceCalculation && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Нажмите "Сделать перерасчёт" для расчёта итоговой суммы
              </Alert>
            )}

            <TextField
              fullWidth
              label="Наличные"
              type="number"
              value={paymentsByMethod.cash}
              onChange={(e) => setPaymentsByMethod({ ...paymentsByMethod, cash: e.target.value })}
              sx={{ mb: 2 }}
              inputProps={{ min: 0 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => fillPaymentMethod('cash')}
                      edge="end"
                      size="small"
                      title="Заполнить всей суммой"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Карта"
              type="number"
              value={paymentsByMethod.card}
              onChange={(e) => setPaymentsByMethod({ ...paymentsByMethod, card: e.target.value })}
              sx={{ mb: 2 }}
              inputProps={{ min: 0 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => fillPaymentMethod('card')}
                      edge="end"
                      size="small"
                      title="Заполнить всей суммой"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Перевод"
              type="number"
              value={paymentsByMethod.transfer}
              onChange={(e) => setPaymentsByMethod({ ...paymentsByMethod, transfer: e.target.value })}
              sx={{ mb: 2 }}
              inputProps={{ min: 0 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => fillPaymentMethod('transfer')}
                      edge="end"
                      size="small"
                      title="Заполнить всей суммой"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {priceCalculation && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Сумма: {formatCurrency(
                  parseFloat(paymentsByMethod.cash || '0') +
                  parseFloat(paymentsByMethod.card || '0') +
                  parseFloat(paymentsByMethod.transfer || '0')
                )}
              </Alert>
            )}

            <Button
              fullWidth
              variant="contained"
              startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving || selectedRegistrations.size === 0}
            >
              {saving ? 'Сохранение...' : 'Создать оплату'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </>
  );

  return (
    <Box>
      <Stepper activeStep={currentStep === 'select' ? 0 : 1} sx={{ mb: 3 }}>
        <Step>
          <StepLabel>Выбор заявок</StepLabel>
        </Step>
        <Step>
          <StepLabel>Редактирование и оплата</StepLabel>
        </Step>
      </Stepper>

      {currentStep === 'select' ? renderSelectStep() : renderEditStep()}
    </Box>
  );
};
