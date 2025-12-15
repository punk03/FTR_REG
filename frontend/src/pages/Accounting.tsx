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
  Divider,
  InputAdornment,
  useMediaQuery,
  useTheme,
  Chip,
  Stack,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
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
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'amount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [accountingData, setAccountingData] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [deleteGroupConfirmOpen, setDeleteGroupConfirmOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);
  const [restoreGroupConfirmOpen, setRestoreGroupConfirmOpen] = useState(false);
  const [groupToRestore, setGroupToRestore] = useState<string | null>(null);
  const [showDeletedGroups, setShowDeletedGroups] = useState(false);
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [discountPercent, setDiscountPercent] = useState('');
  const [editGroupNameDialogOpen, setEditGroupNameDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
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
  }, [selectedEventId, showDeletedGroups]);

  const fetchAccounting = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/accounting', {
        params: {
          eventId: selectedEventId,
          includeDeleted: showDeletedGroups,
          page: 1,
          limit: 10000, // Получаем все записи сразу
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

  const handleDeleteGroupClick = (groupId: string) => {
    setGroupToDelete(groupId);
    setDeleteGroupConfirmOpen(true);
  };

  const handleDeleteGroupConfirm = async () => {
    if (!groupToDelete) return;

    try {
      await api.delete(`/api/accounting/payment-group/${groupToDelete}`);
      fetchAccounting();
      showSuccess('Группа платежей успешно удалена');
      setDeleteGroupConfirmOpen(false);
      setGroupToDelete(null);
    } catch (error: any) {
      console.error('Error deleting payment group:', error);
      showError(error.response?.data?.error || 'Ошибка удаления группы платежей');
    }
  };

  const handleRestoreGroupClick = (groupId: string) => {
    setGroupToRestore(groupId);
    setRestoreGroupConfirmOpen(true);
  };

  const handleRestoreGroupConfirm = async () => {
    if (!groupToRestore) return;

    try {
      await api.post(`/api/accounting/payment-group/${groupToRestore}/restore`);
      fetchAccounting();
      showSuccess('Группа платежей успешно восстановлена');
      setRestoreGroupConfirmOpen(false);
      setGroupToRestore(null);
    } catch (error: any) {
      console.error('Error restoring payment group:', error);
      showError(error.response?.data?.error || 'Ошибка восстановления группы платежей');
    }
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
  // Группы всегда развернуты (без возможности сворачивания)
  const groupedArray = Object.entries(grouped).map(([groupId, entries]: [string, any]) => {
    const groupEntries = Array.isArray(entries) ? entries : [];
    const totalAmount = groupEntries.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
    const performanceEntries = groupEntries.filter((e: any) => e.paidFor === 'PERFORMANCE');
    const totalDiscount = performanceEntries.reduce((sum: number, e: any) => sum + Number(e.discountAmount), 0);
    const firstEntry = groupEntries[0];
    // Группа считается удалённой, если все её записи удалены (deletedAt не null)
    const isDeleted = firstEntry?.deletedAt !== null && firstEntry?.deletedAt !== undefined;
    
    // Фильтруем записи группы по статусу удаления
    const filteredEntries = groupEntries.filter((entry: any) => {
      const entryDeleted = entry.deletedAt !== null && entry.deletedAt !== undefined;
      if (!showDeletedGroups && entryDeleted) {
        return false;
      }
      if (showDeletedGroups && !entryDeleted) {
        return false;
      }
      return true;
    });
    
    return {
      type: 'group' as const,
      groupId,
      paymentGroupName: firstEntry?.paymentGroupName || `Группа ${groupId.slice(0, 8)}`,
      createdAt: firstEntry?.createdAt || new Date(),
      totalAmount,
      totalDiscount,
      entries: filteredEntries,
      hasPerformance: performanceEntries.length > 0,
      isDeleted,
    };
  }).filter((item) => {
    // Фильтруем удалённые группы, если не включён показ удалённых
    if (!showDeletedGroups && item.isDeleted) {
      return false;
    }
    // Если включён показ удалённых, показываем только удалённые
    if (showDeletedGroups && !item.isDeleted) {
      return false;
    }
    return true;
  });

  // Одиночные записи
  const ungroupedArray = ungrouped
    .filter((entry: any) => {
      const isDeleted = entry.deletedAt !== null && entry.deletedAt !== undefined;
      if (!showDeletedGroups && isDeleted) {
        return false;
      }
      if (showDeletedGroups && !isDeleted) {
        return false;
      }
      return true;
    })
    .map((entry: any) => ({
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
    <Box sx={{ px: { xs: 0.5, sm: 2 }, pb: 2, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
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

        {user?.role === 'ADMIN' && (
          <FormControlLabel
            control={
              <Checkbox 
                checked={showDeletedGroups} 
                onChange={(e) => setShowDeletedGroups(e.target.checked)} 
              />
            }
            label="Показать удалённые группы"
          />
        )}

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
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 4, width: '100%' }}>
            <Grid item xs={6} sm={6} md={3}>
              <Card 
                sx={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': { transform: 'translateY(-4px)' }
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, opacity: 0.9, mb: 0.5 }}>
                    Итого получено
                  </Typography>
                  <Typography variant="h5" sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' }, fontWeight: 700 }}>
                    {formatCurrency(summary.grandTotal + summary.totalDiscount)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={6} md={3}>
              <Card 
                sx={{ 
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(245, 87, 108, 0.3)',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': { transform: 'translateY(-4px)' }
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, opacity: 0.9, mb: 0.5 }}>
                    После откатов
                  </Typography>
                  <Typography variant="h5" sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' }, fontWeight: 700 }}>
                    {formatCurrency(summary.grandTotal)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={6} md={3}>
              <Card 
                sx={{ 
                  background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(250, 112, 154, 0.3)',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': { transform: 'translateY(-4px)' }
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, opacity: 0.9, mb: 0.5 }}>
                    Выданные откаты
                  </Typography>
                  <Typography variant="h5" sx={{ fontSize: { xs: '1.1rem', sm: '1.5rem' }, fontWeight: 700 }}>
                    {formatCurrency(summary.totalDiscount)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={12} md={3}>
              <Card 
                sx={{ 
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(79, 172, 254, 0.3)',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': { transform: 'translateY(-4px)' }
                }}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, opacity: 0.9, mb: 1 }}>
                    Выступления
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 500 }}>
                      Наличные: {formatCurrency(summary.performance.cash)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 500 }}>
                      Карта: {formatCurrency(summary.performance.card)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, fontWeight: 500 }}>
                      Перевод: {formatCurrency(summary.performance.transfer)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper 
            sx={{ 
              overflow: 'hidden',
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ p: { xs: 1.5, sm: 3 }, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                mb: 3,
                pb: 2,
                borderBottom: '2px solid',
                borderColor: 'divider',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 2
              }}>
                <Typography 
                  variant="h5" 
                  sx={{ 
                    fontSize: { xs: '1.1rem', sm: '1.5rem' },
                    fontWeight: 600,
                    color: 'primary.main',
                    letterSpacing: '0.5px'
                  }}
                >
                  Все платежи
                </Typography>
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1, 
                  flexWrap: 'wrap',
                  width: { xs: '100%', sm: 'auto' }
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
                    size={isMobile ? 'small' : 'medium'}
                  >
                    {isMobile ? 'Excel' : 'Excel'}
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
                    size={isMobile ? 'small' : 'medium'}
                  >
                    {isMobile ? 'CSV' : 'CSV'}
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
                    size={isMobile ? 'small' : 'medium'}
                  >
                    {isMobile ? 'PDF' : 'PDF'}
                  </Button>
                  {(user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<AddIcon />}
                      onClick={() => setCreatePaymentDialogOpen(true)}
                      disabled={!selectedEventId}
                      fullWidth={isMobile}
                      size={isMobile ? 'small' : 'medium'}
                    >
                      {isMobile ? 'Добавить' : 'Добавить платеж'}
                    </Button>
                  )}
                </Box>
              </Box>
              
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : allItems.length === 0 ? (
                <Typography sx={{ p: 3 }}>Нет платежей</Typography>
              ) : isMobile ? (
                // Мобильная версия с карточками
                <Box>
                  {allItems.map((item: any) => {
                    if (item.type === 'group') {
                      const paymentTime = formatTime(item.createdAt);
                      
                      return (
                        <React.Fragment key={item.groupId}>
                          {/* Заголовок группы */}
                          <Card 
                            sx={{ 
                              mb: 1, 
                              mt: 2,
                              width: '100%', 
                              maxWidth: '100%',
                              border: '2px solid',
                              borderColor: item.isDeleted ? 'error.main' : 'primary.main',
                              backgroundColor: item.isDeleted ? 'error.light' : 'primary.light',
                              opacity: item.isDeleted ? 0.7 : 1,
                              boxShadow: item.isDeleted ? 'none' : '0 4px 12px rgba(25, 118, 210, 0.2)',
                              transition: 'all 0.2s ease-in-out',
                              '&:hover': {
                                boxShadow: item.isDeleted ? 'none' : '0 6px 16px rgba(25, 118, 210, 0.3)',
                                transform: item.isDeleted ? 'none' : 'translateY(-2px)'
                              }
                            }}
                          >
                            <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                              <Box sx={{ mb: 1, width: '100%' }}>
                                <Typography 
                                  variant="body1" 
                                  sx={{ 
                                    fontWeight: 600, 
                                    fontSize: { xs: '0.95rem', sm: '1rem' },
                                    wordBreak: 'break-word',
                                    color: 'primary.dark'
                                  }}
                                >
                                  {item.paymentGroupName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                                  {formatDate(item.createdAt)} {paymentTime} • {item.entries.length} {item.entries.length === 1 ? 'запись' : 'записей'}
                                </Typography>
                              </Box>
                              
                              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
                                <Chip 
                                  label={`Сумма: ${formatCurrency(item.totalAmount)}`} 
                                  size="small" 
                                  color="primary"
                                  sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 22, sm: 24 } }}
                                />
                                {item.hasPerformance && item.totalDiscount > 0 && (
                                  <Chip 
                                    label={`Откат: ${formatCurrency(item.totalDiscount)}`} 
                                    size="small" 
                                    color="secondary"
                                    sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 22, sm: 24 } }}
                                  />
                                )}
                              </Stack>
                              
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1, width: '100%' }}>
                                {item.isDeleted ? (
                                  user?.role === 'ADMIN' && (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      color="success"
                                      onClick={() => handleRestoreGroupClick(item.groupId)}
                                      sx={{ 
                                        fontSize: { xs: '0.7rem', sm: '0.75rem' }, 
                                        px: { xs: 0.75, sm: 1 },
                                        py: { xs: 0.25, sm: 0.5 },
                                        minWidth: 'auto'
                                      }}
                                    >
                                      Восстановить
                                    </Button>
                                  )
                                ) : (
                                  <>
                                    {user?.role === 'ADMIN' && (
                                      <>
                                        <Button
                                          variant="outlined"
                                          size="small"
                                          onClick={() => handleEditGroupNameClick(item.groupId)}
                                          sx={{ 
                                            fontSize: { xs: '0.7rem', sm: '0.75rem' }, 
                                            px: { xs: 0.75, sm: 1 },
                                            py: { xs: 0.25, sm: 0.5 },
                                            minWidth: 'auto'
                                          }}
                                        >
                                          Редактировать
                                        </Button>
                                        <Button
                                          variant="outlined"
                                          size="small"
                                          color="error"
                                          onClick={() => handleDeleteGroupClick(item.groupId)}
                                          sx={{ 
                                            fontSize: { xs: '0.7rem', sm: '0.75rem' }, 
                                            px: { xs: 0.75, sm: 1 },
                                            py: { xs: 0.25, sm: 0.5 },
                                            minWidth: 'auto'
                                          }}
                                        >
                                          Удалить
                                        </Button>
                                      </>
                                    )}
                                    {item.hasPerformance && (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        color="secondary"
                                        onClick={() => handleDiscountClick(item.groupId)}
                                        sx={{ 
                                          fontSize: { xs: '0.7rem', sm: '0.75rem' }, 
                                          px: { xs: 0.75, sm: 1 },
                                          py: { xs: 0.25, sm: 0.5 },
                                          minWidth: 'auto'
                                        }}
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
                                  </>
                                )}
                              </Box>
                            </CardContent>
                          </Card>
                          
                          {/* Записи группы (группированные по регистрациям) */}
                          {(() => {
                            // Группируем записи по registrationId
                            const groupedByRegistration: { [key: string]: any[] } = {};
                            const manualPayments: any[] = [];
                            
                            item.entries.forEach((entry: any) => {
                              if (entry.registrationId) {
                                const regId = String(entry.registrationId);
                                if (!groupedByRegistration[regId]) {
                                  groupedByRegistration[regId] = [];
                                }
                                groupedByRegistration[regId].push(entry);
                              } else {
                                manualPayments.push(entry);
                              }
                            });
                            
                            // Вычисляем общее разбиение по способам оплаты для группы
                            const groupPaymentMethods = item.entries.reduce((acc: any, e: any) => {
                              acc[e.method] = (acc[e.method] || 0) + Number(e.amount);
                              return acc;
                            }, {});
                            
                            return (
                              <>
                                {/* Записи по регистрациям */}
                                {Object.entries(groupedByRegistration).map(([regId, entries]: [string, any[]]) => {
                                  const firstEntry = entries[0];
                                  const performanceEntries = entries.filter((e: any) => e.paidFor === 'PERFORMANCE');
                                  const diplomasEntries = entries.filter((e: any) => e.paidFor === 'DIPLOMAS_MEDALS');
                                  const performanceAmount = performanceEntries.reduce((sum, e) => sum + Number(e.amount), 0);
                                  const diplomasAmount = diplomasEntries.reduce((sum, e) => sum + Number(e.amount), 0);
                                  const performanceDiscount = performanceEntries.reduce((sum, e) => sum + Number(e.discountAmount || 0), 0);
                                  const entryTime = formatTime(firstEntry.createdAt);
                                  
                                  return (
                                    <Card 
                                      key={regId} 
                                      variant="outlined"
                                      sx={{ 
                                        mb: 1, 
                                        ml: 2,
                                        width: 'calc(100% - 16px)',
                                        backgroundColor: firstEntry.deletedAt ? 'error.light' : 'rgba(0, 0, 0, 0.02)',
                                        opacity: firstEntry.deletedAt ? 0.7 : 1
                                      }}
                                    >
                                      <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                                        <Typography 
                                          variant="body2" 
                                          sx={{ 
                                            fontWeight: 500, 
                                            mb: 0.5,
                                            fontSize: { xs: '0.85rem', sm: '0.875rem' },
                                            wordBreak: 'break-word'
                                          }}
                                        >
                                          {firstEntry.registration?.danceName || '-'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                                          {formatDate(firstEntry.createdAt)} {entryTime}
                                        </Typography>
                                        <Stack spacing={0.5} sx={{ width: '100%' }}>
                                          {firstEntry.registrationId && firstEntry.registration && (
                                            <>
                                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, wordBreak: 'break-word' }}>
                                                Номер: {formatRegistrationNumber(firstEntry.registration)}
                                              </Typography>
                                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, wordBreak: 'break-word' }}>
                                                Коллектив: {firstEntry.collective?.name || firstEntry.registration.collective?.name || '-'}
                                              </Typography>
                                              {firstEntry.registration.danceName && (
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, wordBreak: 'break-word' }}>
                                                  Танец: {firstEntry.registration.danceName}
                                                </Typography>
                                              )}
                                              {firstEntry.registration.notes && (
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, wordBreak: 'break-word', fontStyle: 'italic' }}>
                                                  📝 {firstEntry.registration.notes}
                                                </Typography>
                                              )}
                                            </>
                                          )}
                                          
                                          {/* Выступление */}
                                          {performanceEntries.length > 0 && (
                                            <Box sx={{ mt: 1, p: 1, backgroundColor: 'rgba(25, 118, 210, 0.08)', borderRadius: 1 }}>
                                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.85rem' }, mb: 0.5 }}>
                                                Выступление: {formatCurrency(performanceAmount)}
                                              </Typography>
                                              {performanceDiscount > 0 && (
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                                  Откат: {formatCurrency(performanceDiscount)}
                                                </Typography>
                                              )}
                                            </Box>
                                          )}
                                          
                                          {/* Дипломы и медали */}
                                          {diplomasEntries.length > 0 && (
                                            <Box sx={{ mt: performanceEntries.length > 0 ? 0.5 : 1, p: 1, backgroundColor: 'rgba(156, 39, 176, 0.08)', borderRadius: 1 }}>
                                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: { xs: '0.8rem', sm: '0.85rem' } }}>
                                                {'Дипломы и медали: '}{formatCurrency(diplomasAmount)}
                                              </Typography>
                                            </Box>
                                          )}
                                        </Stack>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                                
                                {/* Ручные платежи (без регистрации) */}
                                {manualPayments.map((entry: any) => {
                                  const entryTime = formatTime(entry.createdAt);
                                  return (
                                    <Card 
                                      key={entry.id} 
                                      variant="outlined"
                                      sx={{ 
                                        mb: 1, 
                                        ml: 2,
                                        width: 'calc(100% - 16px)',
                                        backgroundColor: entry.deletedAt ? 'error.light' : 'rgba(0, 0, 0, 0.02)',
                                        opacity: entry.deletedAt ? 0.7 : 1
                                      }}
                                    >
                                      <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                                        <Typography 
                                          variant="body2" 
                                          sx={{ 
                                            fontWeight: 500, 
                                            mb: 0.5,
                                            fontSize: { xs: '0.85rem', sm: '0.875rem' },
                                            wordBreak: 'break-word'
                                          }}
                                        >
                                          {entry.description || `Платеж #${entry.id}`}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mb: 0.5 }}>
                                          {formatDate(entry.createdAt)} {entryTime}
                                        </Typography>
                                        <Stack spacing={0.5} sx={{ width: '100%' }}>
                                          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: { xs: '0.85rem', sm: '0.9rem' }, mt: 0.5 }}>
                                            Сумма: {formatCurrency(entry.amount)}
                                          </Typography>
                                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                                            <Chip 
                                              label={entry.paidFor === 'PERFORMANCE' ? 'Выступление' : 'Дипломы и медали'} 
                                              size="small" 
                                              sx={{ height: { xs: 20, sm: 22 }, fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
                                            />
                                            <Chip 
                                              label={entry.method === 'CASH' ? 'Наличные' : entry.method === 'CARD' ? 'Карта' : 'Перевод'} 
                                              size="small" 
                                              sx={{ height: { xs: 20, sm: 22 }, fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
                                            />
                                          </Stack>
                                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                            {!entry.deletedAt && (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                              <>
                                                <IconButton size="small" onClick={() => handleEdit(entry)} sx={{ p: 0.5 }} title="Редактировать">
                                                  <EditIcon fontSize="small" />
                                                </IconButton>
                                                {user?.role === 'ADMIN' && (
                                                  <IconButton size="small" onClick={() => handleDeleteClick(entry.id)} sx={{ p: 0.5 }} title="Удалить">
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
                                })}
                                
                                {/* Общее разбиение по способам оплаты для группы */}
                                <Card 
                                  variant="outlined"
                                  sx={{ 
                                    mb: 1, 
                                    ml: 2,
                                    mt: 1,
                                    width: 'calc(100% - 16px)',
                                    backgroundColor: 'primary.light',
                                    border: '2px solid',
                                    borderColor: 'primary.main'
                                  }}
                                >
                                  <CardContent sx={{ p: { xs: 1, sm: 1.5 }, '&:last-child': { pb: { xs: 1, sm: 1.5 } } }}>
                                    <Typography 
                                      variant="body2" 
                                      sx={{ 
                                        fontWeight: 600, 
                                        mb: 1,
                                        fontSize: { xs: '0.85rem', sm: '0.9rem' },
                                        color: 'primary.dark'
                                      }}
                                    >
                                      Разбиение по способам оплаты:
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                                      {groupPaymentMethods.CASH > 0 && (
                                        <Chip 
                                          label={`Наличные: ${formatCurrency(groupPaymentMethods.CASH)}`} 
                                          size="small" 
                                          color="primary"
                                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 24, sm: 26 }, fontWeight: 600 }}
                                        />
                                      )}
                                      {groupPaymentMethods.CARD > 0 && (
                                        <Chip 
                                          label={`Карта: ${formatCurrency(groupPaymentMethods.CARD)}`} 
                                          size="small" 
                                          color="primary"
                                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 24, sm: 26 }, fontWeight: 600 }}
                                        />
                                      )}
                                      {groupPaymentMethods.TRANSFER > 0 && (
                                        <Chip 
                                          label={`Перевод: ${formatCurrency(groupPaymentMethods.TRANSFER)}`} 
                                          size="small" 
                                          color="primary"
                                          sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, height: { xs: 24, sm: 26 }, fontWeight: 600 }}
                                        />
                                      )}
                                    </Stack>
                                  </CardContent>
                                </Card>
                              </>
                            );
                          })()}
                        </React.Fragment>
                      );
                    } else {
                      // Одиночная запись (включая ручные платежи)
                      const entry = item.entry;
                      const paymentName = entry.registrationId 
                        ? (entry.paymentGroupName || entry.registration?.danceName || `Платеж #${entry.id}`)
                        : (entry.description || `Платеж #${entry.id}`);
                      const paymentTime = formatTime(entry.createdAt);
                      const isDeleted = entry.deletedAt !== null && entry.deletedAt !== undefined;
                      
                      // Определяем цвет в зависимости от типа оплаты
                      const getCardColor = () => {
                        if (isDeleted) return { border: 'error.main', bg: 'error.light' };
                        if (entry.paidFor === 'PERFORMANCE') {
                          return { border: 'primary.main', bg: 'rgba(25, 118, 210, 0.05)' };
                        } else if (entry.paidFor === 'DIPLOMAS_MEDALS') {
                          return { border: 'secondary.main', bg: 'rgba(156, 39, 176, 0.05)' };
                        }
                        return { border: 'divider', bg: 'background.paper' };
                      };
                      
                      const cardColors = getCardColor();
                      
                      return (
                        <Card 
                          key={entry.id} 
                          sx={{ 
                            mb: 2, 
                            width: '100%', 
                            maxWidth: '100%',
                            border: '2px solid',
                            borderColor: cardColors.border,
                            backgroundColor: cardColors.bg,
                            opacity: isDeleted ? 0.7 : 1,
                            boxShadow: isDeleted ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                              boxShadow: isDeleted ? 'none' : '0 4px 12px rgba(0,0,0,0.15)',
                              transform: isDeleted ? 'none' : 'translateY(-2px)'
                            }
                          }}
                        >
                          <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                            <Box sx={{ mb: 0.5, width: '100%' }}>
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  fontWeight: 500, 
                                  fontSize: { xs: '0.9rem', sm: '0.95rem' },
                                  wordBreak: 'break-word'
                                }}
                              >
                                {paymentName}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', display: 'block', mt: 0.5 }}>
                                {formatDate(entry.createdAt)} {paymentTime}
                              </Typography>
                            </Box>
                            
                            <Stack spacing={0.5} sx={{ mt: 1, width: '100%' }}>
                              {entry.registrationId && entry.registration && (
                                <>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, wordBreak: 'break-word' }}>
                                    Номер: {formatRegistrationNumber(entry.registration)}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, wordBreak: 'break-word' }}>
                                    Коллектив: {entry.collective?.name || entry.registration.collective?.name || '-'}
                                  </Typography>
                                  {entry.registration.danceName && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, wordBreak: 'break-word' }}>
                                      Танец: {entry.registration.danceName}
                                    </Typography>
                                  )}
                                  {entry.registration.notes && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, wordBreak: 'break-word', fontStyle: 'italic', mt: 0.5 }}>
                                      📝 {entry.registration.notes}
                                    </Typography>
                                  )}
                                </>
                              )}
                              <Typography variant="body2" sx={{ fontWeight: 500, mt: 0.5, fontSize: { xs: '0.85rem', sm: '0.875rem' } }}>
                                Сумма: {formatCurrency(entry.amount)}
                              </Typography>
                              {entry.discountAmount > 0 && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                  Откат: {formatCurrency(entry.discountAmount)}
                                </Typography>
                              )}
                              <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                                <Chip 
                                  label={entry.paidFor === 'PERFORMANCE' ? 'Выступление' : 'Дипломы и медали'} 
                                  size="small" 
                                  sx={{ height: { xs: 20, sm: 22 }, fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
                                />
                                <Chip 
                                  label={entry.method === 'CASH' ? 'Наличные' : entry.method === 'CARD' ? 'Карта' : 'Перевод'} 
                                  size="small" 
                                  variant="outlined"
                                  sx={{ height: { xs: 20, sm: 22 }, fontSize: { xs: '0.65rem', sm: '0.7rem' } }}
                                />
                              </Stack>
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
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
                                {!isDeleted && (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                  <>
                                    <IconButton size="small" onClick={() => handleEdit(entry)} sx={{ p: 0.5 }} title="Редактировать">
                                      <EditIcon fontSize="small" />
                                    </IconButton>
                                    {user?.role === 'ADMIN' && (
                                      <IconButton size="small" onClick={() => handleDeleteClick(entry.id)} sx={{ p: 0.5 }} title="Удалить">
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
                </Box>
              ) : (
                // Десктопная версия с таблицей
                <TableContainer sx={{ width: '100%', overflowX: 'auto', borderRadius: 1 }}>
                  <Table size="small" sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: 'primary.dark' }}>
                        <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: 'none', py: 1.5 }}>
                          <TableSortLabel
                            active={sortBy === 'createdAt'}
                            direction={sortBy === 'createdAt' ? sortOrder : 'asc'}
                            onClick={() => handleSort('createdAt')}
                            sx={{ color: 'white !important', '& .MuiTableSortLabel-icon': { color: 'white !important' } }}
                          >
                            Название / Дата
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: 'none', py: 1.5 }}>Номер регистрации</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: 'none', py: 1.5 }}>Коллектив</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: 'none', py: 1.5 }}>Название танца</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: 'none', py: 1.5 }}>
                          <TableSortLabel
                            active={sortBy === 'amount'}
                            direction={sortBy === 'amount' ? sortOrder : 'asc'}
                            onClick={() => handleSort('amount')}
                            sx={{ color: 'white !important', '& .MuiTableSortLabel-icon': { color: 'white !important' } }}
                          >
                            Сумма
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: 'none', py: 1.5 }}>Откат</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: 'none', py: 1.5 }}>Категория</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: 'none', py: 1.5 }}>Способ оплаты</TableCell>
                        <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: 'none', py: 1.5 }}>Действия</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {allItems.map((item: any) => {
                        if (item.type === 'group') {
                          const paymentTime = formatTime(item.createdAt);
                          
                          return (
                            <React.Fragment key={item.groupId}>
                              {/* Заголовок группы */}
                              <TableRow sx={{ 
                                backgroundColor: item.isDeleted ? 'error.light' : 'primary.light',
                                opacity: item.isDeleted ? 0.7 : 1,
                                borderLeft: item.isDeleted ? '4px solid' : '4px solid',
                                borderColor: item.isDeleted ? 'error.main' : 'primary.main',
                                boxShadow: item.isDeleted ? 'none' : '0 2px 4px rgba(0,0,0,0.1)'
                              }}>
                                <TableCell colSpan={9}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.dark' }}>
                                      {item.paymentGroupName}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                      {formatDate(item.createdAt)} {paymentTime} • {item.entries.length} {item.entries.length === 1 ? 'запись' : 'записей'} • 
                                      Сумма: {formatCurrency(item.totalAmount)}
                                      {item.hasPerformance && item.totalDiscount > 0 && ` • Откат: ${formatCurrency(item.totalDiscount)}`}
                                    </Typography>
                                    <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
                                      {item.isDeleted ? (
                                        user?.role === 'ADMIN' && (
                                          <Button
                                            variant="outlined"
                                            size="small"
                                            color="success"
                                            onClick={() => handleRestoreGroupClick(item.groupId)}
                                            sx={{ minWidth: 'auto', px: 1 }}
                                          >
                                            Восстановить
                                          </Button>
                                        )
                                      ) : (
                                        <>
                                          {user?.role === 'ADMIN' && (
                                            <>
                                              <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() => handleEditGroupNameClick(item.groupId)}
                                                sx={{ minWidth: 'auto', px: 1 }}
                                              >
                                                Редактировать
                                              </Button>
                                              <Button
                                                variant="outlined"
                                                size="small"
                                                color="error"
                                                onClick={() => handleDeleteGroupClick(item.groupId)}
                                                sx={{ minWidth: 'auto', px: 1 }}
                                              >
                                                Удалить
                                              </Button>
                                            </>
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
                                        </>
                                      )}
                                    </Box>
                                  </Box>
                                </TableCell>
                              </TableRow>
                              {/* Записи группы (группированные по регистрациям) */}
                              {(() => {
                                // Группируем записи по registrationId
                                const groupedByRegistration: { [key: string]: any[] } = {};
                                const manualPayments: any[] = [];
                                
                                item.entries.forEach((entry: any) => {
                                  if (entry.registrationId) {
                                    const regId = String(entry.registrationId);
                                    if (!groupedByRegistration[regId]) {
                                      groupedByRegistration[regId] = [];
                                    }
                                    groupedByRegistration[regId].push(entry);
                                  } else {
                                    manualPayments.push(entry);
                                  }
                                });
                                
                                // Вычисляем общее разбиение по способам оплаты для группы
                                const groupPaymentMethods = item.entries.reduce((acc: any, e: any) => {
                                  acc[e.method] = (acc[e.method] || 0) + Number(e.amount);
                                  return acc;
                                }, {});
                                
                                return (
                                  <>
                                    {/* Записи по регистрациям */}
                                    {Object.entries(groupedByRegistration).map(([regId, entries]: [string, any[]]) => {
                                      const firstEntry = entries[0];
                                      const performanceEntries = entries.filter((e: any) => e.paidFor === 'PERFORMANCE');
                                      const diplomasEntries = entries.filter((e: any) => e.paidFor === 'DIPLOMAS_MEDALS');
                                      const performanceAmount = performanceEntries.reduce((sum, e) => sum + Number(e.amount), 0);
                                      const diplomasAmount = diplomasEntries.reduce((sum, e) => sum + Number(e.amount), 0);
                                      const performanceDiscount = performanceEntries.reduce((sum, e) => sum + Number(e.discountAmount || 0), 0);
                                      const entryTime = formatTime(firstEntry.createdAt);
                                      
                                      return (
                                        <React.Fragment key={`${regId}-fragment`}>
                                          {/* Выступление */}
                                          {performanceEntries.length > 0 && (
                                            <TableRow 
                                              key={`${regId}-performance`}
                                              sx={{ 
                                                backgroundColor: firstEntry.deletedAt ? 'rgba(211, 47, 47, 0.1)' : 'rgba(25, 118, 210, 0.05)',
                                                borderLeft: '4px solid',
                                                borderColor: firstEntry.deletedAt ? 'error.main' : 'primary.main',
                                                opacity: firstEntry.deletedAt ? 0.7 : 1,
                                                transition: 'all 0.2s ease-in-out',
                                                '&:hover': {
                                                  backgroundColor: firstEntry.deletedAt ? 'rgba(211, 47, 47, 0.1)' : 'rgba(25, 118, 210, 0.08)'
                                                }
                                              }}
                                            >
                                              <TableCell sx={{ pl: 6 }}>
                                                <Box>
                                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                    {firstEntry.registration?.danceName || '-'}
                                                  </Typography>
                                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                    {formatDate(firstEntry.createdAt)} {entryTime}
                                                  </Typography>
                                                </Box>
                                              </TableCell>
                                              <TableCell>
                                                {firstEntry.registration ? formatRegistrationNumber(firstEntry.registration) : '-'}
                                              </TableCell>
                                              <TableCell>
                                                {firstEntry.collective?.name || firstEntry.registration?.collective?.name || '-'}
                                              </TableCell>
                                              <TableCell>{firstEntry.registration?.danceName || '-'}</TableCell>
                                              <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(performanceAmount)}</TableCell>
                                              <TableCell>{performanceDiscount > 0 ? formatCurrency(performanceDiscount) : '-'}</TableCell>
                                              <TableCell>
                                                <Chip 
                                                  label="Выступление" 
                                                  size="small" 
                                                  color="primary"
                                                  sx={{ height: 24, fontSize: '0.7rem' }}
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                  -
                                                </Typography>
                                              </TableCell>
                                              <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                                  {!firstEntry.deletedAt && (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                                    <>
                                                      <IconButton size="small" onClick={() => handleEdit(firstEntry)} title="Редактировать">
                                                        <EditIcon fontSize="small" />
                                                      </IconButton>
                                                      {user?.role === 'ADMIN' && (
                                                        <IconButton size="small" onClick={() => handleDeleteClick(firstEntry.id)} title="Удалить">
                                                          <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                      )}
                                                    </>
                                                  )}
                                                </Box>
                                              </TableCell>
                                            </TableRow>
                                          )}
                                          
                                          {/* Дипломы и медали */}
                                          {diplomasEntries.length > 0 && (
                                            <TableRow 
                                              key={`${regId}-diplomas`}
                                              sx={{ 
                                                backgroundColor: firstEntry.deletedAt ? 'rgba(211, 47, 47, 0.1)' : 'rgba(156, 39, 176, 0.05)',
                                                borderLeft: '4px solid',
                                                borderColor: firstEntry.deletedAt ? 'error.main' : 'secondary.main',
                                                opacity: firstEntry.deletedAt ? 0.7 : 1,
                                                transition: 'all 0.2s ease-in-out',
                                                '&:hover': {
                                                  backgroundColor: firstEntry.deletedAt ? 'rgba(211, 47, 47, 0.1)' : 'rgba(156, 39, 176, 0.08)'
                                                }
                                              }}
                                            >
                                              <TableCell sx={{ pl: 6 }}>
                                                <Box>
                                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                    {firstEntry.registration?.danceName || '-'}
                                                  </Typography>
                                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                    {formatDate(firstEntry.createdAt)} {entryTime}
                                                  </Typography>
                                                </Box>
                                              </TableCell>
                                              <TableCell>
                                                {firstEntry.registration ? formatRegistrationNumber(firstEntry.registration) : '-'}
                                              </TableCell>
                                              <TableCell>
                                                {firstEntry.collective?.name || firstEntry.registration?.collective?.name || '-'}
                                              </TableCell>
                                              <TableCell>{firstEntry.registration?.danceName || '-'}</TableCell>
                                              <TableCell sx={{ fontWeight: 600 }}>{formatCurrency(diplomasAmount)}</TableCell>
                                              <TableCell>-</TableCell>
                                              <TableCell>
                                                <Chip 
                                                  label="Дипломы и медали" 
                                                  size="small" 
                                                  color="secondary"
                                                  sx={{ height: 24, fontSize: '0.7rem' }}
                                                />
                                              </TableCell>
                                              <TableCell>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                  -
                                                </Typography>
                                              </TableCell>
                                              <TableCell>
                                                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                                  {!firstEntry.deletedAt && (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                                    <>
                                                      <IconButton size="small" onClick={() => handleEdit(firstEntry)} title="Редактировать">
                                                        <EditIcon fontSize="small" />
                                                      </IconButton>
                                                      {user?.role === 'ADMIN' && (
                                                        <IconButton size="small" onClick={() => handleDeleteClick(firstEntry.id)} title="Удалить">
                                                          <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                      )}
                                                    </>
                                                  )}
                                                </Box>
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </React.Fragment>
                                      );
                                    })}
                                    
                                    {/* Ручные платежи (без регистрации) */}
                                    {manualPayments.map((entry: any) => {
                                      const entryTime = formatTime(entry.createdAt);
                                      const getManualPaymentColor = () => {
                                        if (entry.deletedAt) return { bg: 'rgba(211, 47, 47, 0.1)', border: 'error.main' };
                                        if (entry.paidFor === 'PERFORMANCE') {
                                          return { bg: 'rgba(25, 118, 210, 0.05)', border: 'primary.main' };
                                        } else if (entry.paidFor === 'DIPLOMAS_MEDALS') {
                                          return { bg: 'rgba(156, 39, 176, 0.05)', border: 'secondary.main' };
                                        }
                                        return { bg: 'rgba(0, 0, 0, 0.02)', border: 'divider' };
                                      };
                                      const manualColors = getManualPaymentColor();
                                      return (
                                        <TableRow 
                                          key={entry.id} 
                                          sx={{ 
                                            backgroundColor: manualColors.bg,
                                            borderLeft: '4px solid',
                                            borderColor: manualColors.border,
                                            opacity: entry.deletedAt ? 0.7 : 1,
                                            transition: 'all 0.2s ease-in-out',
                                            '&:hover': {
                                              backgroundColor: entry.deletedAt ? manualColors.bg : 'rgba(0, 0, 0, 0.04)'
                                            }
                                          }}
                                        >
                                          <TableCell sx={{ pl: 6 }}>
                                            <Box>
                                              <Typography variant="body2">
                                                {entry.description || `Платеж #${entry.id}`}
                                              </Typography>
                                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                {formatDate(entry.createdAt)} {entryTime}
                                              </Typography>
                                            </Box>
                                          </TableCell>
                                          <TableCell>-</TableCell>
                                          <TableCell>-</TableCell>
                                          <TableCell>-</TableCell>
                                          <TableCell>{formatCurrency(entry.amount)}</TableCell>
                                          <TableCell>{entry.discountAmount > 0 ? formatCurrency(entry.discountAmount) : '-'}</TableCell>
                                          <TableCell>
                                            <Chip 
                                              label={entry.paidFor === 'PERFORMANCE' ? 'Выступление' : 'Дипломы и медали'} 
                                              size="small" 
                                              sx={{ height: 24, fontSize: '0.7rem' }}
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Chip 
                                              label={entry.method === 'CASH' ? 'Наличные' : entry.method === 'CARD' ? 'Карта' : 'Перевод'} 
                                              size="small" 
                                              variant="outlined"
                                              sx={{ height: 22, fontSize: '0.65rem' }}
                                            />
                                          </TableCell>
                                          <TableCell>
                                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                              {!entry.deletedAt && (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                                <>
                                                  <IconButton size="small" onClick={() => handleEdit(entry)} title="Редактировать">
                                                    <EditIcon fontSize="small" />
                                                  </IconButton>
                                                  {user?.role === 'ADMIN' && (
                                                    <IconButton size="small" onClick={() => handleDeleteClick(entry.id)} title="Удалить">
                                                      <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                  )}
                                                </>
                                              )}
                                            </Box>
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                    
                                    {/* Общее разбиение по способам оплаты для группы */}
                                    <TableRow 
                                      sx={{ 
                                        backgroundColor: 'primary.light',
                                        borderTop: '2px solid',
                                        borderColor: 'primary.main'
                                      }}
                                    >
                                      <TableCell colSpan={4} sx={{ fontWeight: 600, color: 'primary.dark' }}>
                                        Разбиение по способам оплаты:
                                      </TableCell>
                                      <TableCell colSpan={5}>
                                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                                          {groupPaymentMethods.CASH > 0 && (
                                            <Chip 
                                              label={`Наличные: ${formatCurrency(groupPaymentMethods.CASH)}`} 
                                              size="small" 
                                              color="primary"
                                              sx={{ fontSize: '0.75rem', height: 26, fontWeight: 600 }}
                                            />
                                          )}
                                          {groupPaymentMethods.CARD > 0 && (
                                            <Chip 
                                              label={`Карта: ${formatCurrency(groupPaymentMethods.CARD)}`} 
                                              size="small" 
                                              color="primary"
                                              sx={{ fontSize: '0.75rem', height: 26, fontWeight: 600 }}
                                            />
                                          )}
                                          {groupPaymentMethods.TRANSFER > 0 && (
                                            <Chip 
                                              label={`Перевод: ${formatCurrency(groupPaymentMethods.TRANSFER)}`} 
                                              size="small" 
                                              color="primary"
                                              sx={{ fontSize: '0.75rem', height: 26, fontWeight: 600 }}
                                            />
                                          )}
                                        </Stack>
                                      </TableCell>
                                    </TableRow>
                                  </>
                                );
                              })()}
                            </React.Fragment>
                          );
                        } else {
                          // Одиночная запись (включая ручные платежи)
                          const entry = item.entry;
                          const isDeleted = entry.deletedAt !== null && entry.deletedAt !== undefined;
                          const paymentName = entry.registrationId 
                            ? (entry.paymentGroupName || entry.registration?.danceName || `Платеж #${entry.id}`)
                            : (entry.description || `Платеж #${entry.id}`);
                          const paymentTime = formatTime(entry.createdAt);
                          
                          // Определяем цвет в зависимости от типа оплаты
                          const getRowColor = () => {
                            if (isDeleted) return { bg: 'rgba(211, 47, 47, 0.1)', border: 'error.main' };
                            if (entry.paidFor === 'PERFORMANCE') {
                              return { bg: 'rgba(25, 118, 210, 0.05)', border: 'primary.light' };
                            } else if (entry.paidFor === 'DIPLOMAS_MEDALS') {
                              return { bg: 'rgba(156, 39, 176, 0.05)', border: 'secondary.light' };
                            }
                            return { bg: 'inherit', border: 'transparent' };
                          };
                          
                          const rowColors = getRowColor();
                          
                          return (
                            <TableRow 
                              key={entry.id}
                              sx={{ 
                                backgroundColor: rowColors.bg,
                                borderLeft: `4px solid ${rowColors.border}`,
                                opacity: isDeleted ? 0.7 : 1,
                                transition: 'all 0.2s ease-in-out',
                                '&:hover': {
                                  backgroundColor: isDeleted ? rowColors.bg : 'rgba(0,0,0,0.02)',
                                  boxShadow: isDeleted ? 'none' : '0 2px 8px rgba(0,0,0,0.1)'
                                }
                              }}
                            >
                              <TableCell>
                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {paymentName}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                    {formatDate(entry.createdAt)} {paymentTime}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                {entry.registration ? formatRegistrationNumber(entry.registration) : '-'}
                              </TableCell>
                              <TableCell>
                                {entry.collective?.name || entry.registration?.collective?.name || '-'}
                              </TableCell>
                              <TableCell>
                                {entry.registration?.danceName || '-'}
                              </TableCell>
                              <TableCell sx={{ fontWeight: 500 }}>{formatCurrency(entry.amount)}</TableCell>
                              <TableCell>{entry.discountAmount > 0 ? formatCurrency(entry.discountAmount) : '-'}</TableCell>
                              <TableCell>
                                <Chip 
                                  label={entry.paidFor === 'PERFORMANCE' ? 'Выступление' : 'Дипломы и медали'} 
                                  size="small" 
                                  sx={{ height: 24, fontSize: '0.7rem' }}
                                />
                              </TableCell>
                              <TableCell>
                                <Chip 
                                  label={entry.method === 'CASH' ? 'Наличные' : entry.method === 'CARD' ? 'Карта' : 'Перевод'} 
                                  size="small" 
                                  variant="outlined"
                                  sx={{ height: 22, fontSize: '0.65rem' }}
                                />
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
                                  {!isDeleted && (user?.role === 'ADMIN' || user?.role === 'ACCOUNTANT') && (
                                    <>
                                      <IconButton size="small" onClick={() => handleEdit(entry)} title="Редактировать">
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                      {user?.role === 'ADMIN' && (
                                        <IconButton size="small" onClick={() => handleDeleteClick(entry.id)} title="Удалить">
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
      
      <ConfirmDialog
        open={deleteGroupConfirmOpen}
        title="Удалить группу платежей"
        message="Вы уверены, что хотите удалить эту группу платежей? Все записи в группе будут помечены как удалённые. Это действие можно отменить через восстановление."
        confirmText="Удалить"
        cancelText="Отмена"
        severity="error"
        onConfirm={handleDeleteGroupConfirm}
        onCancel={() => {
          setDeleteGroupConfirmOpen(false);
          setGroupToDelete(null);
        }}
      />
      
      <ConfirmDialog
        open={restoreGroupConfirmOpen}
        title="Восстановить группу платежей"
        message="Вы уверены, что хотите восстановить эту группу платежей? Все записи в группе будут восстановлены."
        confirmText="Восстановить"
        cancelText="Отмена"
        severity="info"
        onConfirm={handleRestoreGroupConfirm}
        onCancel={() => {
          setRestoreGroupConfirmOpen(false);
          setGroupToRestore(null);
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

