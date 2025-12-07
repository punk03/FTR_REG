import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Table,
  TableSortLabel,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  TablePagination,
  Divider,
  InputAdornment,
  useMediaQuery,
  useTheme,
  Chip,
  Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import api from '../services/api';
import { Event } from '../types';
import { formatCurrency, formatDate, formatRegistrationNumber, formatTime } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { exportAccountingToPDF, generatePaymentStatement } from '../utils/pdfExport';


export const Accounting: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'amount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [accountingData, setAccountingData] = useState<any>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState('');
  const [editGroupNameDialogOpen, setEditGroupNameDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    method: 'CASH' as 'CASH' | 'CARD' | 'TRANSFER',
    paidFor: 'PERFORMANCE' as 'PERFORMANCE' | 'DIPLOMAS_MEDALS',
    discountPercent: '',
    description: '',
  });
  const [createPaymentDialogOpen, setCreatePaymentDialogOpen] = useState(false);
  const [createPaymentForm, setCreatePaymentForm] = useState({
    description: '',
    paidFor: 'PERFORMANCE' as 'PERFORMANCE' | 'DIPLOMAS_MEDALS',
    cash: '',
    card: '',
    transfer: '',
  });
  const [creatingPayment, setCreatingPayment] = useState(false);

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
      fetchAccounting();
    }
  }, [selectedEventId, page, rowsPerPage]);

  const fetchAccounting = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/accounting', {
        params: {
          eventId: selectedEventId,
          includeDeleted: false,
          page: page + 1,
          limit: rowsPerPage,
        },
      });
      setAccountingData(response.data);
    } catch (error) {
      console.error('Error fetching accounting:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleEdit = (entry: any) => {
    setSelectedEntry(entry);
    setEditFormData({
      amount: String(entry.amount),
      method: entry.method,
      paidFor: entry.paidFor,
      discountPercent: entry.discountPercent ? String(entry.discountPercent) : '',
      description: entry.description || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEntry) return;

    try {
      const payload: any = {
        amount: parseFloat(editFormData.amount),
        method: editFormData.method,
        paidFor: editFormData.paidFor,
      };

      if (editFormData.paidFor === 'PERFORMANCE' && editFormData.discountPercent) {
        payload.discountPercent = parseFloat(editFormData.discountPercent);
      }

      // Для ручных платежей (без registrationId) можно редактировать description
      if (!selectedEntry.registrationId && editFormData.description) {
        payload.description = editFormData.description;
      }

      await api.put(`/api/accounting/${selectedEntry.id}`, payload);
      setEditDialogOpen(false);
      fetchAccounting();
      showSuccess('Запись успешно обновлена');
    } catch (error: any) {
      console.error('Error updating entry:', error);
      showError(error.response?.data?.error || 'Ошибка обновления');
    }
  };

  const handleDeleteClick = (id: number) => {
    setEntryToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;

    try {
      await api.delete(`/api/accounting/${entryToDelete}`);
      fetchAccounting();
      showSuccess('Запись успешно удалена');
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      showError(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleDiscountClick = (groupId: string) => {
    setSelectedGroupId(groupId);
    // Найти текущий процент отката в группе
    const groupEntries = grouped[groupId] || [];
    const performanceEntry = groupEntries.find((e: any) => e.paidFor === 'PERFORMANCE');
    if (performanceEntry) {
      setDiscountPercent(String(performanceEntry.discountPercent || '0'));
    } else {
      setDiscountPercent('0');
    }
    setDiscountDialogOpen(true);
  };

  const handleApplyDiscount = async () => {
    if (!selectedGroupId) return;

    try {
      await api.put(`/api/accounting/payment-group/${selectedGroupId}/discount`, {
        discountPercent: parseFloat(discountPercent),
      });
      fetchAccounting();
      showSuccess('Откат успешно применен к группе платежей');
      setDiscountDialogOpen(false);
      setSelectedGroupId(null);
      setDiscountPercent('');
    } catch (error: any) {
      console.error('Error applying discount:', error);
      showError(error.response?.data?.error || 'Ошибка применения отката');
    }
  };

  const handleEditGroupNameClick = (groupId: string) => {
    setSelectedGroupId(groupId);
    const groupEntries = grouped[groupId] || [];
    setGroupName(groupEntries[0]?.paymentGroupName || '');
    setEditGroupNameDialogOpen(true);
  };

  const handleSaveGroupName = async () => {
    if (!selectedGroupId) return;

    try {
      await api.put(`/api/accounting/payment-group/${selectedGroupId}/name`, {
        name: groupName,
      });
      fetchAccounting();
      showSuccess('Название группы платежей успешно обновлено');
      setEditGroupNameDialogOpen(false);
      setSelectedGroupId(null);
      setGroupName('');
    } catch (error: any) {
      console.error('Error updating group name:', error);
      showError(error.response?.data?.error || 'Ошибка обновления названия группы');
    }
  };

  const handleCreatePayment = async () => {
    if (!selectedEventId) {
      showError('Выберите мероприятие');
      return;
    }

    if (!createPaymentForm.description.trim()) {
      showError('Введите название платежа');
      return;
    }

    const totalAmount = 
      parseFloat(createPaymentForm.cash || '0') +
      parseFloat(createPaymentForm.card || '0') +
      parseFloat(createPaymentForm.transfer || '0');

    if (totalAmount === 0) {
      showError('Укажите сумму хотя бы в одном способе оплаты');
      return;
    }

    setCreatingPayment(true);
    try {
      await api.post('/api/accounting', {
        description: createPaymentForm.description,
        paidFor: createPaymentForm.paidFor,
        eventId: selectedEventId,
        cash: createPaymentForm.cash || '0',
        card: createPaymentForm.card || '0',
        transfer: createPaymentForm.transfer || '0',
      });
      showSuccess('Платеж успешно добавлен');
      setCreatePaymentDialogOpen(false);
      setCreatePaymentForm({
        description: '',
        paidFor: 'PERFORMANCE',
        cash: '',
        card: '',
        transfer: '',
      });
      fetchAccounting();
    } catch (error: any) {
      console.error('Error creating payment:', error);
      showError(error.response?.data?.error || 'Ошибка создания платежа');
    } finally {
      setCreatingPayment(false);
    }
  };

  const fillPaymentMethodTotal = (method: 'cash' | 'card' | 'transfer') => {
    const total = 
      parseFloat(createPaymentForm.cash || '0') +
      parseFloat(createPaymentForm.card || '0') +
      parseFloat(createPaymentForm.transfer || '0');
    
    // Clear other methods and fill selected one with total
    setCreatePaymentForm({
      ...createPaymentForm,
      cash: method === 'cash' ? (total > 0 ? total.toString() : '') : '',
      card: method === 'card' ? (total > 0 ? total.toString() : '') : '',
      transfer: method === 'transfer' ? (total > 0 ? total.toString() : '') : '',
    });
  };

  const summary = accountingData?.summary || {
    performance: { cash: 0, card: 0, transfer: 0, total: 0 },
    diplomasAndMedals: { cash: 0, card: 0, transfer: 0, total: 0 },
    totalByMethod: { cash: 0, card: 0, transfer: 0 },
    grandTotal: 0,
    totalDiscount: 0,
  };

  const grouped = accountingData?.grouped || {};
  const ungrouped = accountingData?.ungrouped || [];

  // Подготовить данные для отображения: группы и одиночные записи
  const groupedArray = Object.entries(grouped).map(([groupId, entries]: [string, any]) => {
    const groupEntries = Array.isArray(entries) ? entries : [];
    const totalAmount = groupEntries.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const performanceEntries = groupEntries.filter((e: any) => e.paidFor === 'PERFORMANCE');
    const totalDiscount = performanceEntries.reduce((sum: number, e: any) => sum + Number(e.discountAmount), 0);
    const firstEntry = groupEntries[0];
    
    return {
      type: 'group' as const,
      groupId,
      paymentGroupName: firstEntry?.paymentGroupName || `Группа ${groupId.slice(0, 8)}`,
      createdAt: firstEntry?.createdAt || new Date(),
      totalAmount,
      totalDiscount,
      entries: groupEntries,
      hasPerformance: performanceEntries.length > 0,
    };
  });

  // Одиночные записи
  const ungroupedArray = ungrouped.map((entry: any) => ({
    type: 'single' as const,
    entry,
  }));

  // Объединить и отсортировать
  const allItems = [...groupedArray, ...ungroupedArray].sort((a: any, b: any) => {
    let aValue: any;
    let bValue: any;
    
    if (sortBy === 'createdAt') {
      aValue = new Date(a.type === 'group' ? a.createdAt : a.entry.createdAt).getTime();
      bValue = new Date(b.type === 'group' ? b.createdAt : b.entry.createdAt).getTime();
    } else if (sortBy === 'amount') {
      aValue = a.type === 'group' ? a.totalAmount : Number(a.entry.amount);
      bValue = b.type === 'group' ? b.totalAmount : Number(b.entry.amount);
    } else {
      return 0;
    }
    
    if (sortOrder === 'asc') {
      return aValue - bValue;
    } else {
      return bValue - aValue;
    }
  });

  const handleSort = (field: 'createdAt' | 'amount') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, pb: 2 }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between', 
        alignItems: { xs: 'stretch', sm: 'center' }, 
        gap: 2,
        mb: 3 
      }}>
        <FormControl sx={{ minWidth: { xs: '100%', sm: 200 } }}>
          <InputLabel>Событие</InputLabel>
          <Select
            value={selectedEventId}
            label="Событие"
            onChange={(e) => setSelectedEventId(e.target.value as number)}
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
          gap: 1,
          flexDirection: { xs: 'column', sm: 'row' },
          width: { xs: '100%', sm: 'auto' }
        }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={async () => {
              if (accountingData && selectedEventId) {
                try {
                  const event = events.find((e) => e.id === selectedEventId);
                  await exportAccountingToPDF(accountingData, event?.name || 'Неизвестное мероприятие', selectedEventId as number);
                  showSuccess('PDF отчет успешно сгенерирован');
                } catch (error: any) {
                  console.error('Error exporting PDF:', error);
                  showError(error.message || 'Ошибка при создании PDF файла');
                }
              }
            }}
            disabled={!accountingData || !selectedEventId}
            fullWidth={isMobile}
            size={isMobile ? 'medium' : 'medium'}
          >
            {isMobile ? 'PDF' : 'Экспорт в PDF'}
          </Button>
          {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setCreatePaymentDialogOpen(true)}
              disabled={!selectedEventId}
              fullWidth={isMobile}
              size={isMobile ? 'medium' : 'medium'}
            >
              Добавить платеж
            </Button>
          )}
        </Box>
      </Box>

      {selectedEventId && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} sm={6} md={3}>
              <Card>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Итого получено
                  </Typography>
                  <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {formatCurrency(summary.grandTotal + summary.totalDiscount)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={6} md={3}>
              <Card>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    После откатов
                  </Typography>
                  <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {formatCurrency(summary.grandTotal)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={6} md={3}>
              <Card>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Выданные откаты
                  </Typography>
                  <Typography variant="h6" color="error" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                    {formatCurrency(summary.totalDiscount)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={12} md={3}>
              <Card>
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, mb: 0.5 }}>
                    Выступления
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Наличные: {formatCurrency(summary.performance.cash)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Карта: {formatCurrency(summary.performance.card)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                    Перевод: {formatCurrency(summary.performance.transfer)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ 
                display: 'flex', 
                gap: 1, 
                justifyContent: { xs: 'stretch', sm: 'flex-end' }, 
                flexWrap: 'wrap', 
                flexDirection: { xs: 'column', sm: 'row' } 
              }}>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={async () => {
                    if (selectedEventId) {
                      try {
                        const response = await api.get('/api/accounting/export/excel', {
                          params: { eventId: selectedEventId },
                          responseType: 'blob',
                        });
                        const url = window.URL.createObjectURL(new Blob([response.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `accounting_${selectedEventId}_${Date.now()}.xlsx`);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                        showSuccess('Excel файл успешно экспортирован');
                      } catch (error: any) {
                        showError(error.response?.data?.error || 'Ошибка экспорта в Excel');
                      }
                    }
                  }}
                  disabled={!selectedEventId}
                  fullWidth={isMobile}
                  size={isMobile ? 'medium' : 'medium'}
                >
                  {isMobile ? 'Excel' : 'Экспорт в Excel'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={async () => {
                    if (selectedEventId) {
                      try {
                        const response = await api.get('/api/accounting/export/csv', {
                          params: { eventId: selectedEventId },
                          responseType: 'blob',
                        });
                        const url = window.URL.createObjectURL(new Blob([response.data]));
                        const link = document.createElement('a');
                        link.href = url;
                        link.setAttribute('download', `accounting_${selectedEventId}_${Date.now()}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                        window.URL.revokeObjectURL(url);
                        showSuccess('CSV файл успешно экспортирован');
                      } catch (error: any) {
                        showError(error.response?.data?.error || 'Ошибка экспорта в CSV');
                      }
                    }
                  }}
                  disabled={!selectedEventId}
                  fullWidth={isMobile}
                  size={isMobile ? 'medium' : 'medium'}
                >
                  {isMobile ? 'CSV' : 'Экспорт в CSV'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={async () => {
                    if (accountingData && selectedEventId) {
                      try {
                        const event = events.find((e) => e.id === selectedEventId);
                        await exportAccountingToPDF(accountingData, event?.name || 'Неизвестное мероприятие', selectedEventId as number);
                        showSuccess('PDF отчет успешно сгенерирован');
                      } catch (error: any) {
                        console.error('Error exporting PDF:', error);
                        showError(error.message || 'Ошибка при создании PDF файла');
                      }
                    }
                  }}
                  disabled={!accountingData || !selectedEventId}
                  fullWidth={isMobile}
                  size={isMobile ? 'medium' : 'medium'}
                >
                  {isMobile ? 'PDF' : 'Экспорт в PDF'}
                </Button>
                {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => setCreatePaymentDialogOpen(true)}
                    disabled={!selectedEventId}
                    fullWidth={isMobile}
                    size={isMobile ? 'medium' : 'medium'}
                  >
                    Добавить платеж
                  </Button>
                )}
              </Box>
            </Grid>
          </Grid>

          <Paper>
            <Box sx={{ p: { xs: 1, sm: 2 } }}>
              <Typography variant="h6" sx={{ mb: 2, fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>Все платежи</Typography>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : allItems.length === 0 ? (
                <Typography sx={{ p: 3 }}>Нет платежей</Typography>
              ) : isMobile ? (
                // Мобильная версия с карточками
                <Box>
                  {allItems
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((item: any) => {
                      if (item.type === 'group') {
                        const isExpanded = expandedGroups.has(item.groupId);
                        const paymentTime = formatTime(item.createdAt);
                        
                        return (
                          <Card key={item.groupId} sx={{ mb: 2 }}>
                            <CardContent>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                <Box sx={{ flex: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <IconButton
                                      size="small"
                                      onClick={() => toggleGroup(item.groupId)}
                                      sx={{ p: 0.5 }}
                                    >
                                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                    </IconButton>
                                    <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '0.95rem' }}>
                                      {item.paymentGroupName}
                                    </Typography>
                                  </Box>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', ml: 4 }}>
                                    {paymentTime}
                                  </Typography>
                                </Box>
                              </Box>
                              
                              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
                                <Chip label={`Сумма: ${formatCurrency(item.totalAmount)}`} size="small" />
                                {item.hasPerformance && (
                                  <Chip label={`Откат: ${formatCurrency(item.totalDiscount)}`} size="small" color="secondary" />
                                )}
                              </Stack>
                              
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                                {user?.role === 'ADMIN' && (
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => handleEditGroupNameClick(item.groupId)}
                                    sx={{ fontSize: '0.75rem', px: 1 }}
                                  >
                                    Редактировать
                                  </Button>
                                )}
                                {item.hasPerformance && (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    color="secondary"
                                    onClick={() => handleDiscountClick(item.groupId)}
                                    sx={{ fontSize: '0.75rem', px: 1 }}
                                  >
                                    Откат
                                  </Button>
                                )}
                                <IconButton
                                  size="small"
                                  onClick={async () => {
                                    try {
                                      const event = events.find((e) => e.id === selectedEventId);
                                      await generatePaymentStatement(
                                        item.entries,
                                        event?.name || 'Неизвестное мероприятие',
                                        item.paymentGroupName
                                      );
                                      showSuccess('Выписка успешно сформирована');
                                    } catch (error: any) {
                                      console.error('Error generating payment statement:', error);
                                      showError(error.message || 'Ошибка при создании выписки');
                                    }
                                  }}
                                  title="Сформировать выписку"
                                >
                                  <ReceiptIcon fontSize="small" />
                                </IconButton>
                              </Box>
                              
                              <Collapse in={isExpanded}>
                                <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                                  {item.entries.map((entry: any) => (
                                    <Card key={entry.id} variant="outlined" sx={{ mb: 1, backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
                                      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                                          {entry.registration?.danceName || entry.description || '-'}
                                        </Typography>
                                        <Stack spacing={0.5}>
                                          {entry.registrationId && (
                                            <>
                                              <Typography variant="caption" color="text.secondary">
                                                Номер: {formatRegistrationNumber(entry.registration || null)}
                                              </Typography>
                                              <Typography variant="caption" color="text.secondary">
                                                Коллектив: {entry.collective?.name || '-'}
                                              </Typography>
                                            </>
                                          )}
                                          <Typography variant="caption" color="text.secondary">
                                            Сумма: {formatCurrency(entry.amount)}
                                          </Typography>
                                          {entry.discountAmount > 0 && (
                                            <Typography variant="caption" color="text.secondary">
                                              Откат: {formatCurrency(entry.discountAmount)}
                                            </Typography>
                                          )}
                                          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                            <Chip 
                                              label={entry.paidFor === 'PERFORMANCE' ? 'Выступление' : 'Дипломы и медали'} 
                                              size="small" 
                                              sx={{ height: 20, fontSize: '0.7rem' }}
                                            />
                                            <Chip 
                                              label={entry.method === 'CASH' ? 'Наличные' : entry.method === 'CARD' ? 'Карта' : 'Перевод'} 
                                              size="small" 
                                              sx={{ height: 20, fontSize: '0.7rem' }}
                                            />
                                          </Stack>
                                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                            {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                              <>
                                                <IconButton size="small" onClick={() => handleEdit(entry)} sx={{ p: 0.5 }}>
                                                  <EditIcon fontSize="small" />
                                                </IconButton>
                                                {user?.role === 'ADMIN' && (
                                                  <IconButton size="small" onClick={() => handleDeleteClick(entry.id)} sx={{ p: 0.5 }}>
                                                    <DeleteIcon fontSize="small" />
                                                  </IconButton>
                                                )}
                                              </>
                                            )}
                                          </Box>
                                        </Stack>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </Box>
                              </Collapse>
                            </CardContent>
                          </Card>
                        );
                      } else {
                        // Одиночная запись (включая ручные платежи)
                        const entry = item.entry;
                        const paymentName = entry.registrationId 
                          ? (entry.paymentGroupName || `Платеж #${entry.id}`)
                          : (entry.description || `Платеж #${entry.id}`);
                        const paymentTime = formatTime(entry.createdAt);
                        
                        return (
                          <Card key={entry.id} sx={{ mb: 2 }}>
                            <CardContent>
                              <Box sx={{ mb: 0.5 }}>
                                <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '0.95rem' }}>
                                  {paymentName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                  {paymentTime}
                                </Typography>
                              </Box>
                              
                              <Stack spacing={0.5} sx={{ mt: 1 }}>
                                {entry.registrationId && (
                                  <>
                                    <Typography variant="caption" color="text.secondary">
                                      Номер: {formatRegistrationNumber(entry.registration || null)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Коллектив: {entry.collective?.name || '-'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                      Танец: {entry.registration?.danceName || '-'}
                                    </Typography>
                                  </>
                                )}
                                <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5 }}>
                                  Сумма: {formatCurrency(entry.amount)}
                                </Typography>
                                {entry.discountAmount > 0 && (
                                  <Typography variant="caption" color="text.secondary">
                                    Откат: {formatCurrency(entry.discountAmount)}
                                  </Typography>
                                )}
                                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                  <Chip 
                                    label={entry.paidFor === 'PERFORMANCE' ? 'Выступление' : 'Дипломы и медали'} 
                                    size="small" 
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                  <Chip 
                                    label={entry.method === 'CASH' ? 'Наличные' : entry.method === 'CARD' ? 'Карта' : 'Перевод'} 
                                    size="small" 
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                </Stack>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                                  <IconButton
                                    size="small"
                                    onClick={async () => {
                                      try {
                                        const event = events.find((e) => e.id === selectedEventId);
                                        await generatePaymentStatement(
                                          [entry],
                                          event?.name || 'Неизвестное мероприятие'
                                        );
                                        showSuccess('Выписка успешно сформирована');
                                      } catch (error: any) {
                                        console.error('Error generating payment statement:', error);
                                        showError(error.message || 'Ошибка при создании выписки');
                                      }
                                    }}
                                    title="Сформировать выписку"
                                    sx={{ p: 0.5 }}
                                  >
                                    <ReceiptIcon fontSize="small" />
                                  </IconButton>
                                  {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                    <>
                                      <IconButton size="small" onClick={() => handleEdit(entry)} sx={{ p: 0.5 }}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                      {user?.role === 'ADMIN' && (
                                        <IconButton size="small" onClick={() => handleDeleteClick(entry.id)} sx={{ p: 0.5 }}>
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      )}
                                    </>
                                  )}
                                </Box>
                              </Stack>
                            </CardContent>
                          </Card>
                        );
                      }
                    })}
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <TablePagination
                      component="div"
                      count={allItems.length}
                      page={page}
                      onPageChange={(_, newPage) => setPage(newPage)}
                      rowsPerPage={rowsPerPage}
                      onRowsPerPageChange={(e) => {
                        setRowsPerPage(parseInt(e.target.value, 10));
                        setPage(0);
                      }}
                      rowsPerPageOptions={[10, 25, 50, 100]}
                      labelRowsPerPage="На странице:"
                      labelDisplayedRows={({ from, to, count }) => `${from}-${to} из ${count}`}
                    />
                  </Box>
                </Box>
              ) : (
                // Десктопная версия с таблицей
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <TableSortLabel
                            active={sortBy === 'createdAt'}
                            direction={sortBy === 'createdAt' ? sortOrder : 'asc'}
                            onClick={() => handleSort('createdAt')}
                          >
                            Название платежа
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>Номер регистрации</TableCell>
                        <TableCell>Коллектив</TableCell>
                        <TableCell>Название танца</TableCell>
                        <TableCell>
                          <TableSortLabel
                            active={sortBy === 'amount'}
                            direction={sortBy === 'amount' ? sortOrder : 'asc'}
                            onClick={() => handleSort('amount')}
                          >
                            Сумма
                          </TableSortLabel>
                        </TableCell>
                        <TableCell>Откат</TableCell>
                        <TableCell>Категория</TableCell>
                        <TableCell>Способ оплаты</TableCell>
                        <TableCell>Действия</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allItems
                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                        .map((item: any) => {
                          if (item.type === 'group') {
                            const isExpanded = expandedGroups.has(item.groupId);
                            const paymentTime = formatTime(item.createdAt);
                            
                            return (
                              <React.Fragment key={item.groupId}>
                                <TableRow>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <IconButton
                                        size="small"
                                        onClick={() => toggleGroup(item.groupId)}
                                        sx={{ p: 0.5 }}
                                      >
                                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                      </IconButton>
                                      <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                          {item.paymentGroupName}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                          {paymentTime}
                                        </Typography>
                                      </Box>
                                    </Box>
                                  </TableCell>
                                  <TableCell colSpan={3}>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                      <Typography variant="body2" color="text.secondary">
                                        Сумма: {formatCurrency(item.totalAmount)}
                                      </Typography>
                                      {item.hasPerformance && (
                                        <Typography variant="body2" color="text.secondary">
                                          Откат: {formatCurrency(item.totalDiscount)}
                                        </Typography>
                                      )}
                                    </Box>
                                  </TableCell>
                                  <TableCell>{formatCurrency(item.totalAmount)}</TableCell>
                                  <TableCell>{formatCurrency(item.totalDiscount)}</TableCell>
                                  <TableCell>-</TableCell>
                                  <TableCell>-</TableCell>
                                  <TableCell>
                                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                      {user?.role === 'ADMIN' && (
                                        <Button
                                          variant="outlined"
                                          size="small"
                                          onClick={() => handleEditGroupNameClick(item.groupId)}
                                          sx={{ minWidth: 'auto', px: 1 }}
                                        >
                                          Редактировать
                                        </Button>
                                      )}
                                      {item.hasPerformance && (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                        <Button
                                          variant="outlined"
                                          size="small"
                                          color="secondary"
                                          onClick={() => handleDiscountClick(item.groupId)}
                                          sx={{ minWidth: 'auto', px: 1 }}
                                        >
                                          Откат
                                        </Button>
                                      )}
                                      <IconButton
                                        size="small"
                                        onClick={async () => {
                                          try {
                                            const event = events.find((e) => e.id === selectedEventId);
                                            await generatePaymentStatement(
                                              item.entries,
                                              event?.name || 'Неизвестное мероприятие',
                                              item.paymentGroupName
                                            );
                                            showSuccess('Выписка успешно сформирована');
                                          } catch (error: any) {
                                            console.error('Error generating payment statement:', error);
                                            showError(error.message || 'Ошибка при создании выписки');
                                          }
                                        }}
                                        title="Сформировать выписку"
                                      >
                                        <ReceiptIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                  </TableCell>
                                </TableRow>
                                {isExpanded && item.entries.map((entry: any) => (
                                  <TableRow key={entry.id} sx={{ backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
                                    <TableCell sx={{ pl: 6 }}>
                                      <Typography variant="body2" color="text.secondary">
                                        {entry.registration?.danceName || entry.description || '-'}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>{formatRegistrationNumber(entry.registration || null)}</TableCell>
                                    <TableCell>{entry.collective?.name || entry.description || '-'}</TableCell>
                                    <TableCell>{entry.registration?.danceName || '-'}</TableCell>
                                    <TableCell>{formatCurrency(entry.amount)}</TableCell>
                                    <TableCell>{formatCurrency(entry.discountAmount)}</TableCell>
                                    <TableCell>
                                      {entry.paidFor === 'PERFORMANCE' ? 'Выступление' : 'Дипломы и медали'}
                                    </TableCell>
                                    <TableCell>
                                      {entry.method === 'CASH' ? 'Наличные' : entry.method === 'CARD' ? 'Карта' : 'Перевод'}
                                    </TableCell>
                                    <TableCell>
                                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                        {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                          <>
                                            <IconButton size="small" onClick={() => handleEdit(entry)}>
                                              <EditIcon fontSize="small" />
                                            </IconButton>
                                            {user?.role === 'ADMIN' && (
                                              <IconButton size="small" onClick={() => handleDeleteClick(entry.id)}>
                                                <DeleteIcon fontSize="small" />
                                              </IconButton>
                                            )}
                                          </>
                                        )}
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </React.Fragment>
                            );
                          } else {
                            // Одиночная запись (включая ручные платежи)
                            const entry = item.entry;
                            // Для ручных платежей используем description, для остальных - paymentGroupName или номер
                            const paymentName = entry.registrationId 
                              ? (entry.paymentGroupName || `Платеж #${entry.id}`)
                              : (entry.description || `Платеж #${entry.id}`);
                            const paymentTime = formatTime(entry.createdAt);
                            
                            return (
                              <TableRow key={entry.id}>
                                <TableCell>
                                  <Box>
                                    <Typography variant="body2">{paymentName}</Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                      {paymentTime}
                                    </Typography>
                                  </Box>
                                </TableCell>
                                <TableCell>{formatRegistrationNumber(entry.registration || null)}</TableCell>
                                <TableCell>
                                  {entry.registrationId 
                                    ? (entry.collective?.name || '-')
                                    : (entry.description ? '-' : '-')
                                  }
                                </TableCell>
                                <TableCell>
                                  {entry.registrationId 
                                    ? (entry.registration?.danceName || '-')
                                    : '-'
                                  }
                                </TableCell>
                                <TableCell>{formatCurrency(entry.amount)}</TableCell>
                                <TableCell>{formatCurrency(entry.discountAmount)}</TableCell>
                                <TableCell>
                                  {entry.paidFor === 'PERFORMANCE' ? 'Выступление' : 'Дипломы и медали'}
                                </TableCell>
                                <TableCell>
                                  {entry.method === 'CASH' ? 'Наличные' : entry.method === 'CARD' ? 'Карта' : 'Перевод'}
                                </TableCell>
                                <TableCell>
                                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                    <IconButton
                                      size="small"
                                      onClick={async () => {
                                        try {
                                          const event = events.find((e) => e.id === selectedEventId);
                                          await generatePaymentStatement(
                                            [entry],
                                            event?.name || 'Неизвестное мероприятие'
                                          );
                                          showSuccess('Выписка успешно сформирована');
                                        } catch (error: any) {
                                          console.error('Error generating payment statement:', error);
                                          showError(error.message || 'Ошибка при создании выписки');
                                        }
                                      }}
                                      title="Сформировать выписку"
                                    >
                                      <ReceiptIcon fontSize="small" />
                                    </IconButton>
                                    {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                      <>
                                        <IconButton size="small" onClick={() => handleEdit(entry)}>
                                          <EditIcon fontSize="small" />
                                        </IconButton>
                                        {user?.role === 'ADMIN' && (
                                          <IconButton size="small" onClick={() => handleDeleteClick(entry.id)}>
                                            <DeleteIcon fontSize="small" />
                                          </IconButton>
                                        )}
                                      </>
                                    )}
                                  </Box>
                                </TableCell>
                              </TableRow>
                            );
                          }
                        })}
                    </TableBody>
                  </Table>
                  <TablePagination
                    component="div"
                    count={allItems.length}
                    page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setRowsPerPage(parseInt(e.target.value, 10));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    labelRowsPerPage="Записей на странице:"
                  />
                </TableContainer>
              )}
            </Box>
          </Paper>
        </>
      )}

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Редактирование записи</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Сумма *"
                type="number"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                required
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Способ оплаты *</InputLabel>
                <Select
                  value={editFormData.method}
                  label="Способ оплаты *"
                  onChange={(e) => setEditFormData({ ...editFormData, method: e.target.value as any })}
                >
                  <MenuItem value="CASH">Наличные</MenuItem>
                  <MenuItem value="CARD">Карта</MenuItem>
                  <MenuItem value="TRANSFER">Перевод</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Оплачено за *</InputLabel>
                <Select
                  value={editFormData.paidFor}
                  label="Оплачено за *"
                  onChange={(e) => setEditFormData({ ...editFormData, paidFor: e.target.value as any })}
                >
                  <MenuItem value="PERFORMANCE">Выступление</MenuItem>
                  <MenuItem value="DIPLOMAS_MEDALS">Дипломы и медали</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {editFormData.paidFor === 'PERFORMANCE' && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Процент отката"
                  type="number"
                  value={editFormData.discountPercent}
                  onChange={(e) => setEditFormData({ ...editFormData, discountPercent: e.target.value })}
                  inputProps={{ min: 0, max: 100, step: 0.1 }}
                  helperText="Процент отката от суммы выступления"
                />
              </Grid>
            )}
            {selectedEntry && !selectedEntry.registrationId && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Название платежа"
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  helperText="Для ручных платежей"
                />
              </Grid>
            )}
            {selectedEntry && selectedEntry.registrationId && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Коллектив: {selectedEntry.collective?.name || '-'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Регистрация: {selectedEntry.registration?.danceName || '-'}
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSaveEdit}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить эту запись? Это действие можно отменить через восстановление."
        confirmText="Удалить"
        cancelText="Отмена"
        severity="error"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setEntryToDelete(null);
        }}
      />

      <Dialog open={discountDialogOpen} onClose={() => setDiscountDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Управление откатом</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Группа платежей: {selectedGroupId && grouped[selectedGroupId]?.[0]?.paymentGroupName || selectedGroupId?.slice(0, 8)}
          </Typography>
          <TextField
            fullWidth
            label="Процент отката"
            type="number"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            inputProps={{ min: 0, max: 100, step: 0.1 }}
            helperText="Процент отката от общей суммы выступлений в группе (0-100)"
          />
          {selectedGroupId && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Количество записей в группе: {grouped[selectedGroupId]?.filter((e: any) => e.paidFor === 'PERFORMANCE').length || 0}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDiscountDialogOpen(false);
            setSelectedGroupId(null);
            setDiscountPercent('');
          }}>
            Отмена
          </Button>
          <Button variant="contained" onClick={handleApplyDiscount}>
            Применить откат
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editGroupNameDialogOpen} onClose={() => setEditGroupNameDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Редактирование названия группы платежей</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Название группы"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            sx={{ mt: 2 }}
            helperText="Введите новое название для группы платежей"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setEditGroupNameDialogOpen(false);
              setSelectedGroupId(null);
              setGroupName('');
            }}
          >
            Отмена
          </Button>
          <Button variant="contained" onClick={handleSaveGroupName}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog for creating manual payment */}
      <Dialog
        open={createPaymentDialogOpen}
        onClose={() => setCreatePaymentDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Добавить платеж</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Название платежа"
            value={createPaymentForm.description}
            onChange={(e) => setCreatePaymentForm({ ...createPaymentForm, description: e.target.value })}
            margin="normal"
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Категория платежа</InputLabel>
            <Select
              value={createPaymentForm.paidFor}
              onChange={(e) => setCreatePaymentForm({ ...createPaymentForm, paidFor: e.target.value as 'PERFORMANCE' | 'DIPLOMAS_MEDALS' })}
              label="Категория платежа"
            >
              <MenuItem value="PERFORMANCE">Участие</MenuItem>
              <MenuItem value="DIPLOMAS_MEDALS">Дипломы и медали</MenuItem>
            </Select>
          </FormControl>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Способы оплаты
          </Typography>
          <TextField
            fullWidth
            label="Наличные"
            type="number"
            value={createPaymentForm.cash}
            onChange={(e) => setCreatePaymentForm({ ...createPaymentForm, cash: e.target.value })}
            margin="normal"
            inputProps={{ min: 0, step: 0.01 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => fillPaymentMethodTotal('cash')}
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
            value={createPaymentForm.card}
            onChange={(e) => setCreatePaymentForm({ ...createPaymentForm, card: e.target.value })}
            margin="normal"
            inputProps={{ min: 0, step: 0.01 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => fillPaymentMethodTotal('card')}
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
            value={createPaymentForm.transfer}
            onChange={(e) => setCreatePaymentForm({ ...createPaymentForm, transfer: e.target.value })}
            margin="normal"
            inputProps={{ min: 0, step: 0.01 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => fillPaymentMethodTotal('transfer')}
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
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Итого: {formatCurrency(
                parseFloat(createPaymentForm.cash || '0') +
                parseFloat(createPaymentForm.card || '0') +
                parseFloat(createPaymentForm.transfer || '0')
              )}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreatePaymentDialogOpen(false);
            setCreatePaymentForm({
              description: '',
              paidFor: 'PERFORMANCE',
              cash: '',
              card: '',
              transfer: '',
            });
          }}>
            Отмена
          </Button>
          <Button
            onClick={handleCreatePayment}
            variant="contained"
            disabled={creatingPayment}
            startIcon={creatingPayment ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {creatingPayment ? 'Создание...' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

