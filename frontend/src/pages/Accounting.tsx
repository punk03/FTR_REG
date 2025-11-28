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
  Tabs,
  Tab,
  Table,
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
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ReceiptIcon from '@mui/icons-material/Receipt';
import api from '../services/api';
import { Event } from '../types';
import { formatCurrency, formatDate, formatRegistrationNumber } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { exportAccountingToPDF, generatePaymentStatement } from '../utils/pdfExport';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const Accounting: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
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
  });

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

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleEdit = (entry: any) => {
    setSelectedEntry(entry);
    setEditFormData({
      amount: String(entry.amount),
      method: entry.method,
      paidFor: entry.paidFor,
      discountPercent: entry.discountPercent ? String(entry.discountPercent) : '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedEntry) return;

    try {
      const payload: any = {
        amount: parseInt(editFormData.amount),
        method: editFormData.method,
        paidFor: editFormData.paidFor,
      };

      if (editFormData.paidFor === 'PERFORMANCE' && editFormData.discountPercent) {
        payload.discountPercent = parseFloat(editFormData.discountPercent);
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

  const summary = accountingData?.summary || {
    performance: { cash: 0, card: 0, transfer: 0, total: 0 },
    diplomasAndMedals: { cash: 0, card: 0, transfer: 0, total: 0 },
    totalByMethod: { cash: 0, card: 0, transfer: 0 },
    grandTotal: 0,
    totalDiscount: 0,
  };

  const grouped = accountingData?.grouped || {};
  const ungrouped = accountingData?.ungrouped || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
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
        >
          Экспорт в PDF
        </Button>
      </Box>

      {selectedEventId && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Итого получено
                  </Typography>
                  <Typography variant="h6">{formatCurrency(summary.grandTotal + summary.totalDiscount)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    После откатов
                  </Typography>
                  <Typography variant="h6">{formatCurrency(summary.grandTotal)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Выданные откаты
                  </Typography>
                  <Typography variant="h6" color="error">
                    {formatCurrency(summary.totalDiscount)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">
                    Выступления
                  </Typography>
                  <Typography variant="body2">
                    Наличные: {formatCurrency(summary.performance.cash)}
                  </Typography>
                  <Typography variant="body2">
                    Карта: {formatCurrency(summary.performance.card)}
                  </Typography>
                  <Typography variant="body2">
                    Перевод: {formatCurrency(summary.performance.transfer)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: { xs: 'stretch', sm: 'flex-end' }, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' } }}>
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
                  fullWidth={window.innerWidth < 600}
                >
                  Экспорт в Excel
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
                  fullWidth={window.innerWidth < 600}
                >
                  Экспорт в CSV
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
                  fullWidth={window.innerWidth < 600}
                >
                  Экспорт в PDF
                </Button>
              </Box>
            </Grid>
          </Grid>

          <Paper>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label="Объединенные платежи" />
              <Tab label="Одиночные выступления" />
              <Tab label="Одиночные дипломы/медали" />
            </Tabs>

            <TabPanel value={tabValue} index={0}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : Object.keys(grouped).length === 0 ? (
                <Typography sx={{ p: 3 }}>Нет объединенных платежей</Typography>
              ) : (
                Object.entries(grouped).map(([groupId, entries]: [string, any]) => {
                  const groupEntries = Array.isArray(entries) ? entries : [];
                  const performanceEntries = groupEntries.filter((e: any) => e.paidFor === 'PERFORMANCE');
                  const diplomasEntries = groupEntries.filter((e: any) => e.paidFor === 'DIPLOMAS_MEDALS');
                  const totalAmount = groupEntries.reduce((sum: number, e: any) => sum + Number(e.amount), 0);
                  const totalDiscount = performanceEntries.reduce((sum: number, e: any) => sum + Number(e.discountAmount), 0);
                  const isExpanded = expandedGroups.has(groupId);

                  return (
                    <Card key={groupId} sx={{ mb: 2 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="h6">
                              {groupEntries[0]?.paymentGroupName || `Группа ${groupId.slice(0, 8)}`}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Сумма: {formatCurrency(totalAmount)} | Откат: {formatCurrency(totalDiscount)}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            {user?.role === 'ADMIN' && (
                              <>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  onClick={() => handleEditGroupNameClick(groupId)}
                                >
                                  Редактировать название
                                </Button>
                                {performanceEntries.length > 0 && (
                                  <Button
                                    variant="outlined"
                                    size="small"
                                    color="secondary"
                                    onClick={() => handleDiscountClick(groupId)}
                                  >
                                    Откат
                                  </Button>
                                )}
                              </>
                            )}
                            {(user?.role === 'ACCOUNTANT' && user?.role !== 'ADMIN') && performanceEntries.length > 0 && (
                              <Button
                                variant="outlined"
                                size="small"
                                color="secondary"
                                onClick={() => handleDiscountClick(groupId)}
                              >
                                Откат
                              </Button>
                            )}
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ReceiptIcon />}
                              onClick={async () => {
                                try {
                                  const event = events.find((e) => e.id === selectedEventId);
                                  await generatePaymentStatement(
                                    groupEntries,
                                    event?.name || 'Неизвестное мероприятие',
                                    groupEntries[0]?.paymentGroupName || `Группа ${groupId.slice(0, 8)}`
                                  );
                                  showSuccess('Выписка успешно сформирована');
                                } catch (error: any) {
                                  console.error('Error generating payment statement:', error);
                                  showError(error.message || 'Ошибка при создании выписки');
                                }
                              }}
                            >
                              Выписка
                            </Button>
                            <IconButton onClick={() => toggleGroup(groupId)}>
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          </Box>
                        </Box>

                        <Collapse in={isExpanded}>
                          {performanceEntries.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Выступления
                              </Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Номер</TableCell>
                                    <TableCell>Коллектив</TableCell>
                                    <TableCell>Название</TableCell>
                                    <TableCell>Сумма</TableCell>
                                    <TableCell>Откат</TableCell>
                                    <TableCell>Способ</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {performanceEntries.map((entry: any) => (
                                    <TableRow key={entry.id}>
                                      <TableCell>{formatRegistrationNumber(entry.registration)}</TableCell>
                                      <TableCell>{entry.collective?.name}</TableCell>
                                      <TableCell>{entry.registration?.danceName || '-'}</TableCell>
                                      <TableCell>{formatCurrency(entry.amount)}</TableCell>
                                      <TableCell>{formatCurrency(entry.discountAmount)}</TableCell>
                                      <TableCell>
                                        {entry.method === 'CASH' ? 'Наличные' : entry.method === 'CARD' ? 'Карта' : 'Перевод'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                          )}

                          {diplomasEntries.length > 0 && (
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Дипломы и медали
                              </Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Номер</TableCell>
                                    <TableCell>Коллектив</TableCell>
                                    <TableCell>Название</TableCell>
                                    <TableCell>Сумма</TableCell>
                                    <TableCell>Способ</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {diplomasEntries.map((entry: any) => (
                                    <TableRow key={entry.id}>
                                      <TableCell>{formatRegistrationNumber(entry.registration)}</TableCell>
                                      <TableCell>{entry.collective?.name}</TableCell>
                                      <TableCell>{entry.registration?.danceName || '-'}</TableCell>
                                      <TableCell>{formatCurrency(entry.amount)}</TableCell>
                                      <TableCell>
                                        {entry.method === 'CASH' ? 'Наличные' : entry.method === 'CARD' ? 'Карта' : 'Перевод'}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                          )}
                        </Collapse>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabPanel>

            <TabPanel value={tabValue} index={1}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Дата</TableCell>
                      <TableCell>Коллектив</TableCell>
                      <TableCell>Название</TableCell>
                      <TableCell>Сумма</TableCell>
                      <TableCell>Откат</TableCell>
                      <TableCell>Способ</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(ungrouped || [])
                      .filter((e: any) => e.paidFor === 'PERFORMANCE')
                      .map((entry: any) => (
                        <TableRow key={entry.id}>
                          <TableCell>{formatDate(entry.createdAt)}</TableCell>
                          <TableCell>{formatRegistrationNumber(entry.registration)}</TableCell>
                          <TableCell>{entry.collective?.name}</TableCell>
                          <TableCell>{entry.registration?.danceName || '-'}</TableCell>
                          <TableCell>{formatCurrency(entry.amount)}</TableCell>
                          <TableCell>{formatCurrency(entry.discountAmount)}</TableCell>
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
                              {user?.role === 'ADMIN' && (
                                <>
                                  <IconButton size="small" onClick={() => handleEdit(entry)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" onClick={() => handleDeleteClick(entry.id)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </>
                              )}
                              {(user?.role === 'ACCOUNTANT' && user?.role !== 'ADMIN') && (
                                <IconButton size="small" onClick={() => handleEdit(entry)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {accountingData?.pagination && (
                  <TablePagination
                    component="div"
                    count={accountingData.pagination.total}
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
                )}
              </TableContainer>
            </TabPanel>

            <TabPanel value={tabValue} index={2}>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Дата</TableCell>
                      <TableCell>Коллектив</TableCell>
                      <TableCell>Название</TableCell>
                      <TableCell>Сумма</TableCell>
                      <TableCell>Способ</TableCell>
                      <TableCell>Действия</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(ungrouped || [])
                      .filter((e: any) => e.paidFor === 'DIPLOMAS_MEDALS')
                      .map((entry: any) => (
                        <TableRow key={entry.id}>
                          <TableCell>{formatDate(entry.createdAt)}</TableCell>
                          <TableCell>{formatRegistrationNumber(entry.registration)}</TableCell>
                          <TableCell>{entry.collective?.name}</TableCell>
                          <TableCell>{entry.registration?.danceName || '-'}</TableCell>
                          <TableCell>{formatCurrency(entry.amount)}</TableCell>
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
                              {user?.role === 'ADMIN' && (
                                <>
                                  <IconButton size="small" onClick={() => handleEdit(entry)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                  <IconButton size="small" onClick={() => handleDeleteClick(entry.id)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </>
                              )}
                              {(user?.role === 'ACCOUNTANT' && user?.role !== 'ADMIN') && (
                                <IconButton size="small" onClick={() => handleEdit(entry)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
                {accountingData?.pagination && (
                  <TablePagination
                    component="div"
                    count={accountingData.pagination.total}
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
                )}
              </TableContainer>
            </TabPanel>
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
            {selectedEntry && (
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Коллектив: {selectedEntry.collective?.name}
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
    </Box>
  );
};

