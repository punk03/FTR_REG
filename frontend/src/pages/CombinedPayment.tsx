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
  useTheme,
  useMediaQuery,
  Stack,
  Chip,
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
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
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [nominations, setNominations] = useState<any[]>([]);
  const [ages, setAges] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [collectives, setCollectives] = useState<any[]>([]);
  const [customPerformancePrices, setCustomPerformancePrices] = useState<Record<number, { enabled: boolean; price: string }>>({});

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
  }, [currentStep, selectedRegistrations, registrationData, payingPerformance, payingDiplomasAndMedals, applyDiscount, customPerformancePrices]);

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
          danceName: reg.danceName || '',
          collectiveId: reg.collectiveId,
          disciplineId: reg.disciplineId,
          nominationId: reg.nominationId,
          ageId: reg.ageId,
          categoryId: reg.categoryId,
        };
      });
      setRegistrationData(initialData);
      
      // Загружаем справочники для выпадающих списков
      try {
        const [disciplinesRes, nominationsRes, agesRes, categoriesRes] = await Promise.all([
          api.get('/api/reference/disciplines'),
          api.get('/api/reference/nominations'),
          api.get('/api/reference/ages'),
          api.get('/api/reference/categories'),
        ]);
        
        setDisciplines(disciplinesRes.data || []);
        setNominations(nominationsRes.data || []);
        setAges(agesRes.data || []);
        setCategories(categoriesRes.data || []);
      } catch (error) {
        console.error('Error loading reference data:', error);
      }
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

      // Проверяем уникальную цену выступления
      const customPrice = customPerformancePrices[regId];
      let performancePrice = 0;

      if (customPrice?.enabled && customPrice?.price) {
        performancePrice = parseFloat(customPrice.price) || 0;
      } else {
        try {
          const response = await api.get(`/api/registrations/${regId}/calculate-price`, {
            params: {
              participantsCount: data.participantsCount || reg.participantsCount,
              federationParticipantsCount: data.federationParticipantsCount || reg.federationParticipantsCount,
              diplomasCount,
              medalsCount: data.medalsCount || reg.medalsCount,
              nominationId: data.nominationId !== undefined ? data.nominationId : reg.nominationId,
            },
          });
          performancePrice = response.data.performancePrice || 0;
        } catch (error) {
          console.error(`Error calculating price for registration ${regId}:`, error);
          // Используем предыдущее значение, если есть
          performancePrice = registrationPrices[regId]?.performancePrice || 0;
        }
      }

      try {
        const response = await api.get(`/api/registrations/${regId}/calculate-price`, {
          params: {
            participantsCount: data.participantsCount || reg.participantsCount,
            federationParticipantsCount: data.federationParticipantsCount || reg.federationParticipantsCount,
            diplomasCount,
            medalsCount: data.medalsCount || reg.medalsCount,
            nominationId: data.nominationId !== undefined ? data.nominationId : reg.nominationId,
          },
        });

        prices[regId] = {
          performancePrice,
          diplomasPrice: response.data.details?.diplomasPrice || 0,
          medalsPrice: response.data.details?.medalsPrice || 0,
          total: performancePrice + (response.data.details?.diplomasPrice || 0) + (response.data.details?.medalsPrice || 0),
        };
      } catch (error) {
        console.error(`Error calculating price for registration ${regId}:`, error);
        // Используем предыдущие значения, если есть
        const prevPrice = registrationPrices[regId];
        prices[regId] = {
          performancePrice,
          diplomasPrice: prevPrice?.diplomasPrice || 0,
          medalsPrice: prevPrice?.medalsPrice || 0,
          total: performancePrice + (prevPrice?.diplomasPrice || 0) + (prevPrice?.medalsPrice || 0),
        };
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
        
        // Проверяем уникальную цену выступления
        const customPrice = customPerformancePrices[reg.id];
        let performancePrice = 0;
        
        if (customPrice?.enabled && customPrice?.price) {
          performancePrice = parseFloat(customPrice.price) || 0;
        } else {
          const response = await api.get(`/api/registrations/${reg.id}/calculate-price`, {
            params: {
              participantsCount: data.participantsCount || reg.participantsCount,
              federationParticipantsCount: data.federationParticipantsCount || reg.federationParticipantsCount,
              diplomasCount,
              medalsCount: data.medalsCount || reg.medalsCount,
            },
          });
          performancePrice = response.data.performancePrice || (response.data.total - response.data.diplomasAndMedalsPrice);
        }
        
        if (payingPerformance) {
          totalPerformance += performancePrice;
        }
        
        if (payingDiplomasAndMedals) {
          const response = await api.get(`/api/registrations/${reg.id}/calculate-price`, {
            params: {
              participantsCount: data.participantsCount || reg.participantsCount,
              federationParticipantsCount: data.federationParticipantsCount || reg.federationParticipantsCount,
              diplomasCount,
              medalsCount: data.medalsCount || reg.medalsCount,
            },
          });
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

  const handleNext = async () => {
    if (selectedRegistrations.size === 0) {
      showError('Выберите хотя бы одну регистрацию');
      return;
    }
    
    // Загружаем справочники при переходе на шаг редактирования
    try {
      const [disciplinesRes, nominationsRes, agesRes, categoriesRes] = await Promise.all([
        api.get('/api/reference/disciplines'),
        api.get('/api/reference/nominations'),
        api.get('/api/reference/ages'),
        api.get('/api/reference/categories'),
      ]);
      
      setDisciplines(disciplinesRes.data || []);
      setNominations(nominationsRes.data || []);
      setAges(agesRes.data || []);
      setCategories(categoriesRes.data || []);
      
      // Инициализируем уникальные цены для выбранных регистраций
      const initialCustomPrices: Record<number, { enabled: boolean; price: string }> = {};
      selectedRegistrations.forEach((regId) => {
        initialCustomPrices[regId] = { enabled: false, price: '' };
      });
      setCustomPerformancePrices(initialCustomPrices);
    } catch (error) {
      console.error('Error loading reference data:', error);
      showError('Ошибка загрузки справочников');
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
        
        const customPrice = customPerformancePrices[id];
        const result: any = {
          registrationId: id,
          participantsCount: parseInt(data.participantsCount || reg?.participantsCount || 0),
          federationParticipantsCount: parseInt(data.federationParticipantsCount || reg?.federationParticipantsCount || 0),
          medalsCount: parseInt(data.medalsCount || reg?.medalsCount || 0),
          diplomasCount,
          diplomasList: diplomasList || '', // Всегда передаём diplomasList, даже если пустой
          danceName: data.danceName !== undefined ? data.danceName : (reg?.danceName || ''),
          collectiveId: data.collectiveId !== undefined ? data.collectiveId : (reg?.collectiveId || null),
          disciplineId: data.disciplineId !== undefined ? data.disciplineId : (reg?.disciplineId || null),
          nominationId: data.nominationId !== undefined ? data.nominationId : (reg?.nominationId || null),
          ageId: data.ageId !== undefined ? data.ageId : (reg?.ageId || null),
          categoryId: data.categoryId !== undefined ? data.categoryId : (reg?.categoryId || null),
        };
        
        // Добавляем уникальную цену выступления, если она установлена
        if (customPrice?.enabled && customPrice?.price) {
          result.customPerformancePrice = parseFloat(customPrice.price);
        }
        
        return result;
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
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' }, 
        mb: { xs: 2, sm: 3 },
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 2, sm: 2 }
      }}>
        <FormControl sx={{ minWidth: { xs: '100%', sm: 200 } }}>
          <InputLabel>Событие</InputLabel>
          <Select
            value={selectedEventId}
            label="Событие"
            onChange={(e) => {
              setSelectedEventId(e.target.value as number);
              setSelectedRegistrations(new Set());
            }}
            size={isMobile ? "small" : "medium"}
          >
            {events.map((event) => (
              <MenuItem key={event.id} value={event.id}>
                {event.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 1, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          width: { xs: '100%', sm: 'auto' }
        }}>
          {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => navigate('/accounting')}
              fullWidth={isMobile}
              size={isMobile ? "small" : "medium"}
            >
              Добавить платеж
            </Button>
          )}
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={selectedRegistrations.size === 0}
            endIcon={<ArrowForwardIcon />}
            fullWidth={isMobile}
            size={isMobile ? "small" : "medium"}
          >
            {isMobile ? `Оплата (${selectedRegistrations.size})` : `Перейти к оплате (${selectedRegistrations.size})`}
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: { xs: 1, sm: 2 } }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: { xs: 1.5, sm: 2 },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 1, sm: 0 }
        }}>
          <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Выберите заявки для оплаты
          </Typography>
          {search && (
            <Button 
              size="small" 
              onClick={handleSelectAll}
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
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
          size={isMobile ? "small" : "medium"}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
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
                          <TableCell>Статус оплаты</TableCell>
                          <TableCell>Заметки</TableCell>
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
                      <TableCell>
                        {reg.paymentStatus === 'PAID' && (
                          <Chip label="Оплачено" color="success" size="small" />
                        )}
                        {reg.paymentStatus === 'PERFORMANCE_PAID' && (
                          <Chip label="Выступление оплачено" color="info" size="small" />
                        )}
                        {reg.paymentStatus === 'DIPLOMAS_PAID' && (
                          <Chip label="Дипломы оплачены" color="warning" size="small" />
                        )}
                        {reg.paymentStatus === 'UNPAID' && (
                          <Chip label="Не оплачено" color="default" size="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        {reg.notes ? (
                          <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {reg.notes}
                          </Typography>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Mobile card view */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          {filteredRegistrations.map((reg) => {
            const isSelected = selectedRegistrations.has(reg.id);
            const leaders = reg.leaders?.map((l: any) => l.person?.fullName).filter(Boolean).join(', ') || '-';
            const trainers = reg.trainers?.map((t: any) => t.person?.fullName).filter(Boolean).join(', ') || '-';
            const diplomasList = reg.diplomasList || '';
            const diplomasCount = countRussianLines(diplomasList);

            return (
              <Card 
                key={reg.id} 
                sx={{ 
                  mb: 2, 
                  border: isSelected ? '2px solid' : '1px solid',
                  borderColor: isSelected ? 'primary.main' : 'divider',
                  backgroundColor: isSelected ? 'action.selected' : 'background.paper'
                }}
                onClick={() => handleToggleRegistration(reg.id)}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="h6" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, fontWeight: 600, mb: 0.5 }}>
                        {reg.collective?.name || '-'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' }, mb: 0.5 }}>
                        №{formatRegistrationNumber(reg)} — {reg.danceName || '-'}
                      </Typography>
                    </Box>
                    <Checkbox
                      checked={isSelected}
                      onChange={() => handleToggleRegistration(reg.id)}
                      size="small"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Box>

                  <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                    <Chip 
                      label={`Участников: ${reg.participantsCount || 0}`} 
                      size="small" 
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                    />
                    <Chip 
                      label={`Дипломов: ${diplomasCount}`} 
                      size="small" 
                      color="primary"
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                    />
                    <Chip 
                      label={`Медалей: ${reg.medalsCount || 0}`} 
                      size="small" 
                      color="secondary"
                      sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 20, sm: 24 } }}
                    />
                  </Stack>

                  <Box sx={{ mt: 1, mb: 1 }}>
                    {reg.paymentStatus === 'PAID' && (
                      <Chip label="Оплачено" color="success" size="small" sx={{ fontSize: { xs: '0.65rem', sm: '0.7rem' }, height: { xs: 20, sm: 22 } }} />
                    )}
                    {reg.paymentStatus === 'PERFORMANCE_PAID' && (
                      <Chip label="Выступление оплачено" color="info" size="small" sx={{ fontSize: { xs: '0.65rem', sm: '0.7rem' }, height: { xs: 20, sm: 22 } }} />
                    )}
                    {reg.paymentStatus === 'DIPLOMAS_PAID' && (
                      <Chip label="Дипломы оплачены" color="warning" size="small" sx={{ fontSize: { xs: '0.65rem', sm: '0.7rem' }, height: { xs: 20, sm: 22 } }} />
                    )}
                    {reg.paymentStatus === 'UNPAID' && (
                      <Chip label="Не оплачено" color="default" size="small" sx={{ fontSize: { xs: '0.65rem', sm: '0.7rem' }, height: { xs: 20, sm: 22 } }} />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {leaders !== '-' && (
                      <Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                        Руководители: {leaders}
                      </Typography>
                    )}
                    {trainers !== '-' && (
                      <Typography variant="caption" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                        Тренеры: {trainers}
                      </Typography>
                    )}
                  </Box>
                  {reg.notes && (
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                        📝 {reg.notes}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </Paper>
    </>
  );

  const renderEditStep = () => (
    <>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: { xs: 2, sm: 3 },
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 1, sm: 0 }
      }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
          size={isMobile ? "small" : "medium"}
          fullWidth={isMobile}
        >
          Назад к выбору
        </Button>
        <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, textAlign: { xs: 'center', sm: 'left' } }}>
          Редактирование и оплата ({selectedRegistrations.size} заявок)
        </Typography>
      </Box>

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
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
                  <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                    <Grid container spacing={{ xs: 1.5, sm: 2 }}>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Название танца"
                          value={data.danceName !== undefined ? data.danceName : (reg.danceName || '')}
                          onChange={(e) => {
                            setRegistrationData({
                              ...registrationData,
                              [reg.id]: {
                                ...data,
                                danceName: e.target.value,
                              },
                            });
                          }}
                          size={isMobile ? "small" : "medium"}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                          <InputLabel>Коллектив</InputLabel>
                          <Select
                            value={data.collectiveId !== undefined ? data.collectiveId : (reg.collectiveId || '')}
                            label="Коллектив"
                            onChange={(e) => {
                              setRegistrationData({
                                ...registrationData,
                                [reg.id]: {
                                  ...data,
                                  collectiveId: e.target.value,
                                },
                              });
                            }}
                          >
                            {registrations.map((r) => r.collective).filter((c, index, self) => 
                              c && index === self.findIndex((t) => t?.id === c.id)
                            ).map((collective) => (
                              <MenuItem key={collective?.id} value={collective?.id}>
                                {collective?.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                          <InputLabel>Дисциплина</InputLabel>
                          <Select
                            value={data.disciplineId !== undefined ? data.disciplineId : (reg.disciplineId || '')}
                            label="Дисциплина"
                            onChange={(e) => {
                              setRegistrationData({
                                ...registrationData,
                                [reg.id]: {
                                  ...data,
                                  disciplineId: e.target.value,
                                },
                              });
                            }}
                          >
                            {disciplines.map((discipline) => (
                              <MenuItem key={discipline.id} value={discipline.id}>
                                {discipline.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                          <InputLabel>Номинация</InputLabel>
                          <Select
                            value={data.nominationId !== undefined ? data.nominationId : (reg.nominationId || '')}
                            label="Номинация"
                            onChange={(e) => {
                              setRegistrationData({
                                ...registrationData,
                                [reg.id]: {
                                  ...data,
                                  nominationId: e.target.value,
                                },
                              });
                            }}
                          >
                            {nominations.map((nomination) => (
                              <MenuItem key={nomination.id} value={nomination.id}>
                                {nomination.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                          <InputLabel>Возраст</InputLabel>
                          <Select
                            value={data.ageId !== undefined ? data.ageId : (reg.ageId || '')}
                            label="Возраст"
                            onChange={(e) => {
                              setRegistrationData({
                                ...registrationData,
                                [reg.id]: {
                                  ...data,
                                  ageId: e.target.value,
                                },
                              });
                            }}
                          >
                            {ages.map((age) => (
                              <MenuItem key={age.id} value={age.id}>
                                {age.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                          <InputLabel>Категория</InputLabel>
                          <Select
                            value={data.categoryId !== undefined ? data.categoryId : (reg.categoryId || '')}
                            label="Категория"
                            onChange={(e) => {
                              setRegistrationData({
                                ...registrationData,
                                [reg.id]: {
                                  ...data,
                                  categoryId: e.target.value,
                                },
                              });
                            }}
                          >
                            {categories.map((category) => (
                              <MenuItem key={category.id} value={category.id}>
                                {category.name}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" color="text.secondary">
                          Руководители: {leaders}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Тренеры: {trainers}
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
                          size={isMobile ? "small" : "medium"}
                          value={currentTotal}
                          onChange={(e) => handleParticipantsChange(reg.id, e.target.value, false)}
                          inputProps={{ min: currentFederation }}
                          helperText={`Обычных: ${currentRegular}`}
                          sx={{
                            '& .MuiInputBase-input': {
                              fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                            }
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth
                          label="Участников федерации"
                          type="number"
                          size={isMobile ? "small" : "medium"}
                          value={currentFederation}
                          onChange={(e) => handleParticipantsChange(reg.id, e.target.value, true)}
                          inputProps={{ min: 0, max: currentTotal }}
                          sx={{
                            '& .MuiInputBase-input': {
                              fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                            }
                          }}
                        />
                      </Grid>
                      <Grid item xs={6} sm={3}>
                        <TextField
                          fullWidth
                          label="Медалей"
                          type="number"
                          size={isMobile ? "small" : "medium"}
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
                          size={isMobile ? "small" : "medium"}
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
                          rows={isMobile ? 4 : 3}
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
                          size={isMobile ? "small" : "medium"}
                          sx={{
                            '& .MuiInputBase-input': {
                              fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                            }
                          }}
                        />
                      </Grid>
                    </Grid>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ mb: 2 }}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={customPerformancePrices[reg.id]?.enabled || false}
                            onChange={(e) => {
                              setCustomPerformancePrices({
                                ...customPerformancePrices,
                                [reg.id]: {
                                  enabled: e.target.checked,
                                  price: e.target.checked ? (customPerformancePrices[reg.id]?.price || '') : '',
                                },
                              });
                            }}
                            size={isMobile ? "small" : "medium"}
                          />
                        }
                        label={<Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Уникальная цена выступления</Typography>}
                      />
                      {customPerformancePrices[reg.id]?.enabled && (
                        <TextField
                          fullWidth
                          label="Цена выступления (₽)"
                          type="number"
                          value={customPerformancePrices[reg.id]?.price || ''}
                          onChange={(e) => {
                            setCustomPerformancePrices({
                              ...customPerformancePrices,
                              [reg.id]: {
                                enabled: true,
                                price: e.target.value,
                              },
                            });
                          }}
                          sx={{ mt: 1 }}
                          size={isMobile ? "small" : "medium"}
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      )}
                    </Box>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Стоимость за номер: <strong>{formatCurrency(
                          customPerformancePrices[reg.id]?.enabled && customPerformancePrices[reg.id]?.price
                            ? parseFloat(customPerformancePrices[reg.id].price) || 0
                            : prices.performancePrice
                        )}</strong>
                        {customPerformancePrices[reg.id]?.enabled && (
                          <Chip label="Уникальная" color="primary" size="small" sx={{ ml: 1 }} />
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Дипломы: <strong>{formatCurrency(prices.diplomasPrice)}</strong>
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Медали: <strong>{formatCurrency(prices.medalsPrice)}</strong>
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 1 }}>
                        Итого за номер: <strong>{formatCurrency(
                          (customPerformancePrices[reg.id]?.enabled && customPerformancePrices[reg.id]?.price
                            ? parseFloat(customPerformancePrices[reg.id].price) || 0
                            : prices.performancePrice) + prices.diplomasPrice + prices.medalsPrice
                        )}</strong>
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
              Оплата
            </Typography>

            <FormControlLabel
              control={
                <Checkbox
                  checked={payingPerformance}
                  onChange={(e) => setPayingPerformance(e.target.checked)}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={<Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Оплатить выступления</Typography>}
            />

            <FormControlLabel
              control={
                <Checkbox
                  checked={payingDiplomasAndMedals}
                  onChange={(e) => setPayingDiplomasAndMedals(e.target.checked)}
                  size={isMobile ? "small" : "medium"}
                />
              }
              label={<Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Оплатить дипломы и медали</Typography>}
            />

            {payingPerformance && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={applyDiscount}
                    onChange={(e) => setApplyDiscount(e.target.checked)}
                    size={isMobile ? "small" : "medium"}
                  />
                }
                label={<Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Применить откат</Typography>}
              />
            )}

            <TextField
              fullWidth
              label="Название группы платежей"
              value={paymentGroupName}
              onChange={(e) => setPaymentGroupName(e.target.value)}
              sx={{ mt: 2 }}
              size={isMobile ? "small" : "medium"}
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
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                  Выступления: {formatCurrency(priceCalculation.performance)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                  Дипломы/медали: {formatCurrency(priceCalculation.diplomas)}
                </Typography>
                {priceCalculation.discount > 0 && (
                  <Typography variant="body2" color="error" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                    Откат: -{formatCurrency(priceCalculation.discount)}
                  </Typography>
                )}
                <Typography variant="h6" sx={{ mt: 1, fontSize: { xs: '1rem', sm: '1.25rem' } }}>
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
              size={isMobile ? "small" : "medium"}
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
              size={isMobile ? "small" : "medium"}
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
              size={isMobile ? "small" : "medium"}
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
              size={isMobile ? "small" : "medium"}
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
