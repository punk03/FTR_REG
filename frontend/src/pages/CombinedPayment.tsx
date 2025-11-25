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
  Card,
  CardContent,
  FormControlLabel,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import api from '../services/api';
import { Event } from '../types';
import { formatCurrency } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export const CombinedPayment: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [selectedRegistrations, setSelectedRegistrations] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
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

  useEffect(() => {
    if (selectedRegistrations.size > 0) {
      calculateTotalPrice();
    } else {
      setPriceCalculation(null);
    }
  }, [selectedRegistrations, registrationData, payingPerformance, payingDiplomasAndMedals, applyDiscount]);

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
        };
      });
      setRegistrationData(initialData);
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalPrice = async () => {
    if (selectedRegistrations.size === 0) return;

    try {
      const selectedRegs = registrations.filter((r) => selectedRegistrations.has(r.id));
      let totalPerformance = 0;
      let totalDiplomas = 0;

      for (const reg of selectedRegs) {
        const data = registrationData[reg.id] || {};
        const response = await api.get(`/api/registrations/${reg.id}/calculate-price`, {
          params: {
            participantsCount: data.participantsCount || reg.participantsCount,
            federationParticipantsCount: data.federationParticipantsCount || reg.federationParticipantsCount,
            diplomasCount: data.diplomasList ? data.diplomasList.split('\n').filter((s: string) => s.trim()).length : reg.diplomasCount,
            medalsCount: data.medalsCount || reg.medalsCount,
          },
        });

        if (payingPerformance) {
          totalPerformance += response.data.total - response.data.diplomasAndMedalsPrice;
        }
        if (payingDiplomasAndMedals) {
          totalDiplomas += response.data.diplomasAndMedalsPrice;
        }
      }

      let discount = 0;
      if (applyDiscount && payingPerformance) {
        // Получаем discountTiers из события
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
    if (selectedRegistrations.size === registrations.length) {
      setSelectedRegistrations(new Set());
    } else {
      setSelectedRegistrations(new Set(registrations.map((r) => r.id)));
    }
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
        return {
          id,
          participantsCount: data.participantsCount || reg?.participantsCount,
          federationParticipantsCount: data.federationParticipantsCount || reg?.federationParticipantsCount,
          medalsCount: data.medalsCount || reg?.medalsCount,
          diplomasList: data.diplomasList || reg?.diplomasList,
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
      return (
        reg.collective?.name?.toLowerCase().includes(searchLower) ||
        reg.danceName?.toLowerCase().includes(searchLower) ||
        reg.discipline?.name?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <Box>
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
      </Box>

      {selectedEventId && (
        <>
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Регистрации</Typography>
                  <Button size="small" onClick={handleSelectAll}>
                    {selectedRegistrations.size === registrations.length ? 'Снять все' : 'Выбрать все'}
                  </Button>
                </Box>

                <TextField
                  fullWidth
                  placeholder="Поиск..."
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
                          <TableCell>Название</TableCell>
                          <TableCell>Участников</TableCell>
                          <TableCell>Федер.</TableCell>
                          <TableCell>Медали</TableCell>
                          <TableCell>Дипломы</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredRegistrations.map((reg) => {
                          const isSelected = selectedRegistrations.has(reg.id);
                          const data = registrationData[reg.id] || {};

                          return (
                            <TableRow key={reg.id} selected={isSelected}>
                              <TableCell padding="checkbox">
                                <Checkbox
                                  checked={isSelected}
                                  onChange={() => handleToggleRegistration(reg.id)}
                                />
                              </TableCell>
                              <TableCell>{reg.collective?.name}</TableCell>
                              <TableCell>{reg.danceName || '-'}</TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={data.participantsCount || reg.participantsCount}
                                  onChange={(e) => {
                                    setRegistrationData({
                                      ...registrationData,
                                      [reg.id]: {
                                        ...data,
                                        participantsCount: e.target.value,
                                      },
                                    });
                                  }}
                                  inputProps={{ min: 0, style: { width: 60 } }}
                                  disabled={!isSelected}
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={data.federationParticipantsCount || reg.federationParticipantsCount}
                                  onChange={(e) => {
                                    setRegistrationData({
                                      ...registrationData,
                                      [reg.id]: {
                                        ...data,
                                        federationParticipantsCount: e.target.value,
                                      },
                                    });
                                  }}
                                  inputProps={{ min: 0, style: { width: 60 } }}
                                  disabled={!isSelected}
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  type="number"
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
                                  inputProps={{ min: 0, style: { width: 60 } }}
                                  disabled={!isSelected}
                                />
                              </TableCell>
                              <TableCell>
                                <TextField
                                  size="small"
                                  multiline
                                  rows={2}
                                  value={data.diplomasList || reg.diplomasList || ''}
                                  onChange={(e) => {
                                    setRegistrationData({
                                      ...registrationData,
                                      [reg.id]: {
                                        ...data,
                                        diplomasList: e.target.value,
                                      },
                                    });
                                  }}
                                  inputProps={{ style: { width: 150 } }}
                                  disabled={!isSelected}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
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

                <TextField
                  fullWidth
                  label="Наличные"
                  type="number"
                  value={paymentsByMethod.cash}
                  onChange={(e) => setPaymentsByMethod({ ...paymentsByMethod, cash: e.target.value })}
                  sx={{ mb: 2 }}
                  inputProps={{ min: 0 }}
                />

                <TextField
                  fullWidth
                  label="Карта"
                  type="number"
                  value={paymentsByMethod.card}
                  onChange={(e) => setPaymentsByMethod({ ...paymentsByMethod, card: e.target.value })}
                  sx={{ mb: 2 }}
                  inputProps={{ min: 0 }}
                />

                <TextField
                  fullWidth
                  label="Перевод"
                  type="number"
                  value={paymentsByMethod.transfer}
                  onChange={(e) => setPaymentsByMethod({ ...paymentsByMethod, transfer: e.target.value })}
                  sx={{ mb: 2 }}
                  inputProps={{ min: 0 }}
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
      )}
    </Box>
  );
};

