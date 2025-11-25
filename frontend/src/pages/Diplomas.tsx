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
  TablePagination,
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
  CircularProgress,
  Grid,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import api from '../services/api';
import { Event } from '../types';
import { formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const ITEMS_PER_PAGE = 25;

export const Diplomas: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ITEMS_PER_PAGE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showPaid, setShowPaid] = useState(true);
  const [showUnpaid, setShowUnpaid] = useState(true);
  const [showPrinted, setShowPrinted] = useState(true);
  const [showDeleted, setShowDeleted] = useState(false);
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
      fetchRegistrations();
    }
  }, [selectedEventId, page, rowsPerPage, search, showPaid, showUnpaid, showPrinted, showDeleted]);

  const fetchRegistrations = async () => {
    setLoading(true);
    try {
      const params: any = {
        eventId: selectedEventId,
        page: page + 1,
        limit: rowsPerPage,
        includeDeleted: showDeleted,
        deletedOnly: showDeleted && !showPaid && !showUnpaid,
      };

      if (search) {
        params.search = search;
      }

      const response = await api.get('/api/diplomas', { params });
      setRegistrations(response.data.registrations || []);
      setTotal(response.data.pagination?.total || 0);
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
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedRegistration) return;

    try {
      await api.patch(`/api/registrations/${selectedRegistration.id}`, {
        diplomasList: editFormData.diplomasList,
        diplomasCount: parseInt(editFormData.diplomasCount),
        medalsCount: parseInt(editFormData.medalsCount),
      });
      setEditDialogOpen(false);
      fetchRegistrations();
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

  const filteredRegistrations = registrations.filter((reg: any) => {
    if (!showPaid && reg.diplomasAndMedalsPaid) return false;
    if (!showUnpaid && !reg.diplomasAndMedalsPaid) return false;
    if (!showPrinted && reg.diplomasPrinted) return false;
    return true;
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Событие</InputLabel>
          <Select
            value={selectedEventId}
            label="Событие"
            onChange={(e) => {
              setSelectedEventId(e.target.value as number);
              setPage(0);
            }}
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
          sx={{ minWidth: 300 }}
        />

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <FormControlLabel
            control={<Checkbox checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} />}
            label="Оплаченные"
          />
          <FormControlLabel
            control={<Checkbox checked={showUnpaid} onChange={(e) => setShowUnpaid(e.target.checked)} />}
            label="Неоплаченные"
          />
          <FormControlLabel
            control={<Checkbox checked={showPrinted} onChange={(e) => setShowPrinted(e.target.checked)} />}
            label="Распечатанные"
          />
          <FormControlLabel
            control={<Checkbox checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />}
            label="Удаленные"
          />
        </Box>

        {selectedForBulk.size > 0 && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setBulkPayDialogOpen(true)}
            >
              Оплатить ({selectedForBulk.size})
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setBulkPrintDialogOpen(true)}
            >
              Отметить печать ({selectedForBulk.size})
            </Button>
            <Button
              variant="outlined"
              size="small"
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
            >
              Печать PDF ({selectedForBulk.size})
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setSelectedForBulk(new Set())}
            >
              Снять выбор
            </Button>
          </Box>
        )}
      </Box>

      <TableContainer component={Paper}>
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
                      <IconButton size="small" onClick={() => handleEdit(reg)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
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
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
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

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Редактирование дипломов</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={10}
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
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSaveEdit}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkPayDialogOpen} onClose={() => setBulkPayDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Массовая оплата дипломов</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Выбрано регистраций: {selectedForBulk.size}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Наличные"
                type="number"
                value={bulkPayments.cash}
                onChange={(e) => setBulkPayments({ ...bulkPayments, cash: e.target.value })}
                inputProps={{ min: 0 }}
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
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkPayDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleBulkPay}>
            Оплатить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkPrintDialogOpen} onClose={() => setBulkPrintDialogOpen(false)}>
        <DialogTitle>Массовая отметка печати</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Выбрано регистраций: {selectedForBulk.size}
          </Typography>
          <FormControlLabel
            control={<Checkbox defaultChecked />}
            label="Отметить как распечатанные"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkPrintDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={() => handleBulkPrint(true)}>
            Отметить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

