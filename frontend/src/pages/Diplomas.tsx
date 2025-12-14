import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Chip,
  Grid,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
  Stack,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AddIcon from '@mui/icons-material/Add';
import PaymentIcon from '@mui/icons-material/Payment';
import api from '../services/api';
import { Event } from '../types';
import { formatRegistrationNumber } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export const Diplomas: React.FC = () => {
  // const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showPaid, setShowPaid] = useState(true);
  const [showUnpaid, setShowUnpaid] = useState(true);
  const [showPrinted, setShowPrinted] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showOnlyWithDiplomasOrMedals, setShowOnlyWithDiplomasOrMedals] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [selectedForBulk, setSelectedForBulk] = useState<Set<number>>(new Set());
  const [bulkPayDialogOpen, setBulkPayDialogOpen] = useState(false);
  const [bulkPrintDialogOpen, setBulkPrintDialogOpen] = useState(false);
  const [bulkPayments, setBulkPayments] = useState({
    cash: '',
    card: '',
    transfer: '',
  });
  const [editFormData, setEditFormData] = useState({
    diplomasList: '',
    diplomasCount: '',
    medalsCount: '',
    blockNumber: '',
  });
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [registrationToPay, setRegistrationToPay] = useState<any>(null);
  const [singlePayment, setSinglePayment] = useState({
    cash: '',
    card: '',
    transfer: '',
  });
  const [createFormData, setCreateFormData] = useState({
    collectiveName: '',
    disciplineId: '',
    nominationId: '',
    ageId: '',
    categoryId: '',
    danceName: '',
    diplomasList: '',
    diplomasCount: '',
    medalsCount: '',
  });
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [nominations, setNominations] = useState<any[]>([]);
  const [ages, setAges] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [collectives, setCollectives] = useState<any[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const response = await api.get('/api/reference/events');
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
  }, [selectedEventId, search, showPaid, showUnpaid, showPrinted, showDeleted, showOnlyWithDiplomasOrMedals]);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const params: any = {
        eventId: selectedEventId,
        // Загружаем все записи для события за один запрос
        limit: 100000,
        includeDeleted: showDeleted,
        deletedOnly: showDeleted && !showPaid && !showUnpaid,
      };

      if (search) {
        params.search = search;
      }

      const response = await api.get('/api/diplomas', { params });
      setRegistrations(response.data.registrations || []);
    } catch (error) {
      console.error('Error fetching diplomas:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRow = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleEdit = (reg: any) => {
    setSelectedRegistration(reg);
    setEditFormData({
      diplomasList: reg.diplomasList || '',
      diplomasCount: String(reg.diplomasCount || 0),
      medalsCount: String(reg.medalsCount || 0),
      blockNumber: String(reg.blockNumber || ''),
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRegistration) return;

    try {
      const blockNumberValue = editFormData.blockNumber && editFormData.blockNumber.trim() 
        ? parseInt(editFormData.blockNumber) 
        : null;
      
      await api.patch(`/api/registrations/${selectedRegistration.id}`, {
        diplomasList: editFormData.diplomasList,
        diplomasCount: parseInt(editFormData.diplomasCount),
        medalsCount: parseInt(editFormData.medalsCount),
        blockNumber: blockNumberValue,
      });
      
      setEditDialogOpen(false);
      setSelectedRegistration(null);
      
      // Обновляем данные регистрации в локальном состоянии перед перезагрузкой
      setRegistrations((prevRegs) => 
        prevRegs.map((reg: any) => 
          reg.id === selectedRegistration.id
            ? { ...reg, blockNumber: blockNumberValue, diplomasList: editFormData.diplomasList, diplomasCount: parseInt(editFormData.diplomasCount), medalsCount: parseInt(editFormData.medalsCount) }
            : reg
        )
      );
      
      // Перезагружаем данные с сервера для получения актуальной сортировки
      await fetchRegistrations();
      showSuccess('Дипломы успешно обновлены');
    } catch (error: any) {
      console.error('Error updating diplomas:', error);
      showError(error.response?.data?.error || 'Ошибка обновления');
    }
  };

  const handleToggleBulkSelection = (id: number) => {
    const newSelected = new Set(selectedForBulk);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedForBulk(newSelected);
  };

  const handleSelectAllBulk = () => {
    if (selectedForBulk.size === filteredRegistrations.length) {
      setSelectedForBulk(new Set());
    } else {
      setSelectedForBulk(new Set(filteredRegistrations.map((r: any) => r.id)));
    }
  };

  const handleBulkPay = async () => {
    const ids = Array.from(selectedForBulk);
    if (ids.length === 0) {
      showError('Выберите регистрации для оплаты');
      return;
    }

    const totalPaid = parseFloat(bulkPayments.cash || '0') +
      parseFloat(bulkPayments.card || '0') +
      parseFloat(bulkPayments.transfer || '0');

    // Calculate required amount - используем данные события
    const event = events.find((e) => e.id === selectedEventId);
    let requiredAmount = 0;
    for (const reg of filteredRegistrations.filter((r: any) => ids.includes(r.id))) {
      const diplomasPrice = (reg.diplomasCount || 0) * (event?.pricePerDiploma || 0);
      const medalsPrice = (reg.medalsCount || 0) * (event?.pricePerMedal || 0);
      requiredAmount += diplomasPrice + medalsPrice;
    }

    if (Math.abs(totalPaid - requiredAmount) > 1) {
      showError(`Сумма оплаты не совпадает с требуемой. Требуется: ${requiredAmount.toFixed(0)} руб.`);
      return;
    }

    try {
      await api.post('/api/diplomas/pay', {
        registrationIds: ids,
        paymentsByMethod: {
          cash: parseFloat(bulkPayments.cash || '0'),
          card: parseFloat(bulkPayments.card || '0'),
          transfer: parseFloat(bulkPayments.transfer || '0'),
        },
      });
      setBulkPayDialogOpen(false);
      setSelectedForBulk(new Set());
      setBulkPayments({ cash: '', card: '', transfer: '' });
      fetchRegistrations();
      showSuccess('Оплата успешно создана');
    } catch (error: any) {
      console.error('Error creating bulk payment:', error);
      showError(error.response?.data?.error || 'Ошибка создания оплаты');
    }
  };

  const handleBulkPrint = async (printed: boolean) => {
    const ids = Array.from(selectedForBulk);
    if (ids.length === 0) {
      showError('Выберите регистрации для отметки печати');
      return;
    }

    try {
      await api.patch('/api/diplomas/bulk-printed', { registrationIds: ids, printed });
      setBulkPrintDialogOpen(false);
      setSelectedForBulk(new Set());
      fetchRegistrations();
      showSuccess(`Статус печати успешно обновлен для ${ids.length} регистраций`);
    } catch (error: any) {
      console.error('Error updating print status:', error);
      showError(error.response?.data?.error || 'Ошибка обновления статуса печати');
    }
  };

  const handleCreateRegistration = async () => {
    if (!selectedEventId) {
      showError('Выберите событие');
      return;
    }

    if (!createFormData.collectiveName.trim()) {
      showError('Введите название коллектива');
      return;
    }

    if (!createFormData.disciplineId || !createFormData.nominationId || !createFormData.ageId) {
      showError('Заполните все обязательные поля');
      return;
    }

    try {
      const diplomasList = createFormData.diplomasList.trim();
      const diplomasCount = diplomasList ? diplomasList.split('\n').filter((s: string) => s.trim()).length : 0;

      await api.post('/api/registrations', {
        eventId: selectedEventId,
        collectiveName: createFormData.collectiveName,
        disciplineId: parseInt(createFormData.disciplineId),
        nominationId: parseInt(createFormData.nominationId),
        ageId: parseInt(createFormData.ageId),
        categoryId: createFormData.categoryId ? parseInt(createFormData.categoryId) : undefined,
        danceName: createFormData.danceName || undefined,
        participantsCount: 0, // Минимальное значение для заявки только на дипломы/медали
        federationParticipantsCount: 0,
        diplomasList: diplomasList || undefined,
        diplomasCount: diplomasCount || parseInt(createFormData.diplomasCount) || 0,
        medalsCount: parseInt(createFormData.medalsCount) || 0,
        agreement: true,
        agreement2: true,
      });

      setCreateDialogOpen(false);
      setCreateFormData({
        collectiveName: '',
        disciplineId: '',
        nominationId: '',
        ageId: '',
        categoryId: '',
        danceName: '',
        diplomasList: '',
        diplomasCount: '',
        medalsCount: '',
      });
      fetchRegistrations();
      showSuccess('Заявка успешно создана');
    } catch (error: any) {
      console.error('Error creating registration:', error);
      showError(error.response?.data?.error || 'Ошибка создания заявки');
    }
  };

  const handleSinglePay = async () => {
    if (!registrationToPay) return;

    const totalPaid = parseFloat(singlePayment.cash || '0') +
      parseFloat(singlePayment.card || '0') +
      parseFloat(singlePayment.transfer || '0');

    const event = events.find((e) => e.id === selectedEventId);
    const diplomasPrice = (registrationToPay.diplomasCount || 0) * (event?.pricePerDiploma || 0);
    const medalsPrice = (registrationToPay.medalsCount || 0) * (event?.pricePerMedal || 0);
    const requiredAmount = diplomasPrice + medalsPrice;

    if (Math.abs(totalPaid - requiredAmount) > 1) {
      showError(`Сумма оплаты не совпадает с требуемой. Требуется: ${requiredAmount.toFixed(0)} руб.`);
      return;
    }

    try {
      await api.post('/api/diplomas/pay', {
        registrationIds: [registrationToPay.id],
        paymentsByMethod: {
          cash: parseFloat(singlePayment.cash || '0'),
          card: parseFloat(singlePayment.card || '0'),
          transfer: parseFloat(singlePayment.transfer || '0'),
        },
      });
      setPayDialogOpen(false);
      setRegistrationToPay(null);
      setSinglePayment({ cash: '', card: '', transfer: '' });
      fetchRegistrations();
      showSuccess('Оплата успешно создана');
    } catch (error: any) {
      console.error('Error creating payment:', error);
      showError(error.response?.data?.error || 'Ошибка создания оплаты');
    }
  };

  const filteredRegistrations = registrations
    .filter((reg: any) => {
      if (!showPaid && reg.diplomasAndMedalsPaid) return false;
      if (!showUnpaid && !reg.diplomasAndMedalsPaid) return false;
      if (!showPrinted && reg.diplomasPrinted) return false;
      // Фильтр: показывать только те, где заказаны дипломы или медали
      if (showOnlyWithDiplomasOrMedals) {
        const hasDiplomas = (reg.diplomasCount || 0) > 0;
        const hasMedals = (reg.medalsCount || 0) > 0;
        if (!hasDiplomas && !hasMedals) return false;
      }
      return true;
    })
    .sort((a: any, b: any) => {
      // Сортировка по блоку (null значения в конец)
      const blockA = a.blockNumber ?? 999999;
      const blockB = b.blockNumber ?? 999999;
      if (blockA !== blockB) {
        return blockA - blockB;
      }
      // Если блоки одинаковые, сортируем по номеру регистрации
      const numA = a.number ?? 999999;
      const numB = b.number ?? 999999;
      return numA - numB;
    });

  return (
    <Box sx={{ px: { xs: 0, sm: 0 } }}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: { xs: 2, sm: 3 }, 
        flexWrap: 'wrap', 
        gap: { xs: 1, sm: 2 },
        px: { xs: 1, sm: 0 }
      }}>
        <FormControl sx={{ minWidth: { xs: '100%', sm: 200 }, mb: { xs: 1, sm: 0 } }}>
          <InputLabel>Событие</InputLabel>
          <Select
            value={selectedEventId}
            label="Событие"
            onChange={(e) => {
              setSelectedEventId(e.target.value as number);
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

        <TextField
          placeholder="Поиск..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
          }}
          sx={{ 
            minWidth: { xs: '100%', sm: 300 },
            mb: { xs: 1, sm: 0 }
          }}
          size={isMobile ? "small" : "medium"}
        />

        <Box sx={{ 
          display: 'flex', 
          gap: { xs: 0.5, sm: 1 }, 
          flexWrap: 'wrap',
          width: { xs: '100%', sm: 'auto' }
        }}>
          <FormControlLabel
            control={<Checkbox checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} size={isMobile ? "small" : "medium"} />}
            label={<Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Оплаченные</Typography>}
          />
          <FormControlLabel
            control={<Checkbox checked={showUnpaid} onChange={(e) => setShowUnpaid(e.target.checked)} size={isMobile ? "small" : "medium"} />}
            label={<Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Неоплаченные</Typography>}
          />
          <FormControlLabel
            control={<Checkbox checked={showPrinted} onChange={(e) => setShowPrinted(e.target.checked)} size={isMobile ? "small" : "medium"} />}
            label={<Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Распечатанные</Typography>}
          />
          <FormControlLabel
            control={<Checkbox checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} size={isMobile ? "small" : "medium"} />}
            label={<Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Удаленные</Typography>}
          />
          <FormControlLabel
            control={<Checkbox checked={showOnlyWithDiplomasOrMedals} onChange={(e) => setShowOnlyWithDiplomasOrMedals(e.target.checked)} size={isMobile ? "small" : "medium"} />}
            label={<Typography sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Только с дипломами/медалями</Typography>}
          />
        </Box>

        {selectedForBulk.size > 0 && (
          <Box sx={{ 
            display: 'flex', 
            gap: { xs: 0.5, sm: 1 },
            flexWrap: 'wrap',
            width: { xs: '100%', sm: 'auto' },
            mt: { xs: 1, sm: 0 }
          }}>
            <Button
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              onClick={() => setBulkPayDialogOpen(true)}
              fullWidth={isMobile}
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
              Оплатить ({selectedForBulk.size})
            </Button>
            <Button
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              onClick={() => setBulkPrintDialogOpen(true)}
              fullWidth={isMobile}
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
              Печать ({selectedForBulk.size})
            </Button>
            <Button
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              color="secondary"
              startIcon={<FileDownloadIcon />}
              onClick={async () => {
                try {
                  const selectedIds = Array.from(selectedForBulk);
                  if (selectedIds.length === 0) {
                    showError('Выберите хотя бы одну регистрацию');
                    return;
                  }
                  const response = await api.get('/api/diplomas/export/pdf', {
                    params: {
                      eventId: selectedEventId,
                      registrationIds: selectedIds.join(','),
                    },
                    responseType: 'blob',
                  });
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `diplomas_${selectedEventId}_${Date.now()}.pdf`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                  window.URL.revokeObjectURL(url);
                  showSuccess('PDF файл успешно сгенерирован');
                } catch (error: any) {
                  console.error('Error exporting PDF:', error);
                  showError(error.response?.data?.error || 'Ошибка экспорта в PDF');
                }
              }}
              disabled={!selectedEventId}
              fullWidth={isMobile}
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
              {isMobile ? 'PDF' : `Печать PDF (${selectedForBulk.size})`}
            </Button>
            <Button
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              onClick={() => setSelectedForBulk(new Set())}
              fullWidth={isMobile}
              sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
            >
              Снять выбор
            </Button>
          </Box>
        )}
      </Box>

      {/* Desktop table view */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedForBulk.size > 0 && selectedForBulk.size < filteredRegistrations.length}
                  checked={selectedForBulk.size > 0 && selectedForBulk.size === filteredRegistrations.length}
                  onChange={handleSelectAllBulk}
                />
              </TableCell>
              <TableCell />
              <TableCell>Блок</TableCell>
              <TableCell>Коллектив</TableCell>
              <TableCell>Дисциплина</TableCell>
              <TableCell>Номинация</TableCell>
              <TableCell>Возраст</TableCell>
              <TableCell>Название</TableCell>
              <TableCell>Дипломы</TableCell>
              <TableCell>Медали</TableCell>
              <TableCell>Оплачено</TableCell>
              <TableCell>Печать</TableCell>
              <TableCell>Заметки</TableCell>
              <TableCell>Действия</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRegistrations.map((reg: any) => {
              const isExpanded = expandedRows.has(reg.id);
              const diplomasList = reg.diplomasList ? reg.diplomasList.split('\n').filter((s: string) => s.trim()) : [];

              return (
                <React.Fragment key={reg.id}>
                  <TableRow hover selected={selectedForBulk.has(reg.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedForBulk.has(reg.id)}
                        onChange={() => handleToggleBulkSelection(reg.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => toggleRow(reg.id)}>
                        {isExpanded ? <CancelIcon /> : <CheckCircleIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>{reg.blockNumber || '-'}</TableCell>
                    <TableCell>{reg.collective?.name || '-'}</TableCell>
                    <TableCell>{reg.discipline?.name || '-'}</TableCell>
                    <TableCell>{reg.nomination?.name || '-'}</TableCell>
                    <TableCell>{reg.age?.name || '-'}</TableCell>
                    <TableCell>{reg.danceName || '-'}</TableCell>
                    <TableCell>{reg.diplomasCount || 0}</TableCell>
                    <TableCell>{reg.medalsCount || 0}</TableCell>
                    <TableCell>
                      <Chip
                        label={reg.diplomasAndMedalsPaid ? 'Да' : 'Нет'}
                        color={reg.diplomasAndMedalsPaid ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={reg.diplomasPrinted ? 'Да' : 'Нет'}
                        color={reg.diplomasPrinted ? 'success' : 'default'}
                        size="small"
                      />
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
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {!reg.diplomasAndMedalsPaid && (
                          <IconButton 
                            size="small" 
                            onClick={() => {
                              setRegistrationToPay(reg);
                              const event = events.find((e) => e.id === selectedEventId);
                              const diplomasPrice = (reg.diplomasCount || 0) * (event?.pricePerDiploma || 0);
                              const medalsPrice = (reg.medalsCount || 0) * (event?.pricePerMedal || 0);
                              const totalRequired = diplomasPrice + medalsPrice;
                              setSinglePayment({
                                cash: totalRequired > 0 ? totalRequired.toFixed(2) : '',
                                card: '',
                                transfer: '',
                              });
                              setPayDialogOpen(true);
                            }}
                            color="primary"
                            title="Оплатить дипломы и медали"
                          >
                            <PaymentIcon fontSize="small" />
                          </IconButton>
                        )}
                        <IconButton size="small" onClick={() => handleEdit(reg)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={13} sx={{ py: 0 }}>
                      <Collapse in={isExpanded}>
                        <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                          <Typography variant="subtitle2" gutterBottom>
                            Список дипломов:
                          </Typography>
                          {diplomasList.length > 0 ? (
                            <Box component="ul" sx={{ m: 0, pl: 2 }}>
                              {diplomasList.map((name: string, index: number) => (
                                <li key={index}>{name.trim()}</li>
                              ))}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Список пуст
                            </Typography>
                          )}
                          {reg.notes && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Заметки:
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                {reg.notes}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog 
        open={editDialogOpen} 
        onClose={() => setEditDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>Редактирование дипломов</DialogTitle>
        <DialogContent>
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: { xs: 0, sm: 1 } }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={isMobile ? 8 : 10}
                label="Список ФИО для дипломов"
                value={editFormData.diplomasList}
                onChange={(e) => {
                  const value = e.target.value;
                  setEditFormData({
                    ...editFormData,
                    diplomasList: value,
                    diplomasCount: String(value.split('\n').filter((s) => s.trim()).length),
                  });
                }}
                helperText="Введите ФИО участников, каждое с новой строки. Количество дипломов обновится автоматически."
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Количество дипломов"
                type="number"
                value={editFormData.diplomasCount}
                onChange={(e) => setEditFormData({ ...editFormData, diplomasCount: e.target.value })}
                inputProps={{ min: 0 }}
                disabled
                helperText="Автоматически рассчитывается из списка"
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Количество медалей"
                type="number"
                value={editFormData.medalsCount}
                onChange={(e) => setEditFormData({ ...editFormData, medalsCount: e.target.value })}
                inputProps={{ min: 0 }}
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Блок"
                type="number"
                value={editFormData.blockNumber}
                onChange={(e) => setEditFormData({ ...editFormData, blockNumber: e.target.value })}
                inputProps={{ min: 1 }}
                helperText="Номер блока для танца"
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                  }
                }}
              />
            </Grid>
            {selectedRegistration && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Коллектив: {selectedRegistration.collective?.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Название: {selectedRegistration.danceName || '-'}
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
          <Button 
            onClick={() => setEditDialogOpen(false)}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
          >
            Отмена
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveEdit}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
            sx={{ ml: { xs: 0, sm: 1 }, mt: { xs: 1, sm: 0 } }}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={bulkPayDialogOpen} 
        onClose={() => setBulkPayDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>Массовая оплата дипломов</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            Выбрано регистраций: {selectedForBulk.size}
          </Typography>
          <Grid container spacing={{ xs: 1.5, sm: 2 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Наличные"
                type="number"
                value={bulkPayments.cash}
                onChange={(e) => setBulkPayments({ ...bulkPayments, cash: e.target.value })}
                inputProps={{ min: 0 }}
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Карта"
                type="number"
                value={bulkPayments.card}
                onChange={(e) => setBulkPayments({ ...bulkPayments, card: e.target.value })}
                inputProps={{ min: 0 }}
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Перевод"
                type="number"
                value={bulkPayments.transfer}
                onChange={(e) => setBulkPayments({ ...bulkPayments, transfer: e.target.value })}
                inputProps={{ min: 0 }}
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
          <Button 
            onClick={() => setBulkPayDialogOpen(false)}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
          >
            Отмена
          </Button>
          <Button 
            variant="contained" 
            onClick={handleBulkPay}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
            sx={{ ml: { xs: 0, sm: 1 }, mt: { xs: 1, sm: 0 } }}
          >
            Оплатить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog 
        open={bulkPrintDialogOpen} 
        onClose={() => setBulkPrintDialogOpen(false)}
        fullScreen={isMobile}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>Массовая отметка печати</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
            Выбрано регистраций: {selectedForBulk.size}
          </Typography>
          <FormControlLabel
            control={<Checkbox defaultChecked size={isMobile ? "small" : "medium"} />}
            label={<Typography sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Отметить как распечатанные</Typography>}
          />
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
          <Button 
            onClick={() => setBulkPrintDialogOpen(false)}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
          >
            Отмена
          </Button>
          <Button 
            variant="contained" 
            onClick={() => handleBulkPrint(true)}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
            sx={{ ml: { xs: 0, sm: 1 }, mt: { xs: 1, sm: 0 } }}
          >
            Отметить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания заявки на дипломы/медали */}
      <Dialog 
        open={createDialogOpen} 
        onClose={() => setCreateDialogOpen(false)}
        fullScreen={isMobile}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>Создать заявку на дипломы и медали</DialogTitle>
        <DialogContent>
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: { xs: 0, sm: 1 } }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название коллектива *"
                value={createFormData.collectiveName}
                onChange={(e) => setCreateFormData({ ...createFormData, collectiveName: e.target.value })}
                size={isMobile ? "small" : "medium"}
                required
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size={isMobile ? "small" : "medium"}>
                <InputLabel>Дисциплина *</InputLabel>
                <Select
                  value={createFormData.disciplineId}
                  label="Дисциплина *"
                  onChange={(e) => setCreateFormData({ ...createFormData, disciplineId: e.target.value })}
                  required
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
                <InputLabel>Номинация *</InputLabel>
                <Select
                  value={createFormData.nominationId}
                  label="Номинация *"
                  onChange={(e) => setCreateFormData({ ...createFormData, nominationId: e.target.value })}
                  required
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
                <InputLabel>Возраст *</InputLabel>
                <Select
                  value={createFormData.ageId}
                  label="Возраст *"
                  onChange={(e) => setCreateFormData({ ...createFormData, ageId: e.target.value })}
                  required
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
                  value={createFormData.categoryId}
                  label="Категория"
                  onChange={(e) => setCreateFormData({ ...createFormData, categoryId: e.target.value })}
                >
                  <MenuItem value="">Не выбрано</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название танца"
                value={createFormData.danceName}
                onChange={(e) => setCreateFormData({ ...createFormData, danceName: e.target.value })}
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={isMobile ? 6 : 8}
                label="Список ФИО для дипломов"
                value={createFormData.diplomasList}
                onChange={(e) => {
                  const value = e.target.value;
                  const count = value.split('\n').filter((s: string) => s.trim()).length;
                  setCreateFormData({
                    ...createFormData,
                    diplomasList: value,
                    diplomasCount: String(count),
                  });
                }}
                helperText="Введите ФИО участников, каждое с новой строки"
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Количество дипломов"
                type="number"
                value={createFormData.diplomasCount}
                onChange={(e) => setCreateFormData({ ...createFormData, diplomasCount: e.target.value })}
                inputProps={{ min: 0 }}
                disabled
                helperText="Автоматически рассчитывается из списка"
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Количество медалей"
                type="number"
                value={createFormData.medalsCount}
                onChange={(e) => setCreateFormData({ ...createFormData, medalsCount: e.target.value })}
                inputProps={{ min: 0 }}
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' }
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
          <Button 
            onClick={() => setCreateDialogOpen(false)}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
          >
            Отмена
          </Button>
          <Button 
            variant="contained" 
            onClick={handleCreateRegistration}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
            sx={{ ml: { xs: 0, sm: 1 }, mt: { xs: 1, sm: 0 } }}
          >
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог оплаты одной регистрации */}
      <Dialog 
        open={payDialogOpen} 
        onClose={() => {
          setPayDialogOpen(false);
          setRegistrationToPay(null);
          setSinglePayment({ cash: '', card: '', transfer: '' });
        }}
        maxWidth="sm" 
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>Оплата дипломов и медалей</DialogTitle>
        <DialogContent>
          {registrationToPay && (
            <>
              <Typography variant="body2" sx={{ mb: 2, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                Коллектив: {registrationToPay.collective?.name || '-'}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                Танец: {registrationToPay.danceName || '-'}
              </Typography>
              {(() => {
                const event = events.find((e) => e.id === selectedEventId);
                const diplomasPrice = (registrationToPay.diplomasCount || 0) * (event?.pricePerDiploma || 0);
                const medalsPrice = (registrationToPay.medalsCount || 0) * (event?.pricePerMedal || 0);
                const totalRequired = diplomasPrice + medalsPrice;
                return (
                  <Typography variant="body2" sx={{ mb: 2, fontSize: { xs: '0.875rem', sm: '1rem' }, fontWeight: 600 }}>
                    К оплате: {totalRequired.toFixed(2)} руб.
                    {diplomasPrice > 0 && ` (Дипломы: ${diplomasPrice.toFixed(2)} руб.)`}
                    {medalsPrice > 0 && ` (Медали: ${medalsPrice.toFixed(2)} руб.)`}
                  </Typography>
                );
              })()}
            </>
          )}
          <Grid container spacing={{ xs: 1.5, sm: 2 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Наличные"
                type="number"
                value={singlePayment.cash}
                onChange={(e) => setSinglePayment({ ...singlePayment, cash: e.target.value })}
                inputProps={{ min: 0 }}
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Карта"
                type="number"
                value={singlePayment.card}
                onChange={(e) => setSinglePayment({ ...singlePayment, card: e.target.value })}
                inputProps={{ min: 0 }}
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' }
                  }
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Перевод"
                type="number"
                value={singlePayment.transfer}
                onChange={(e) => setSinglePayment({ ...singlePayment, transfer: e.target.value })}
                inputProps={{ min: 0 }}
                size={isMobile ? "small" : "medium"}
                sx={{
                  '& .MuiInputBase-input': {
                    fontSize: { xs: '16px', sm: '1rem' }
                  }
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, sm: 2 }, pb: { xs: 1.5, sm: 2 } }}>
          <Button 
            onClick={() => {
              setPayDialogOpen(false);
              setRegistrationToPay(null);
              setSinglePayment({ cash: '', card: '', transfer: '' });
            }}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
          >
            Отмена
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSinglePay}
            size={isMobile ? "small" : "medium"}
            fullWidth={isMobile}
            sx={{ ml: { xs: 0, sm: 1 }, mt: { xs: 1, sm: 0 } }}
          >
            Оплатить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

