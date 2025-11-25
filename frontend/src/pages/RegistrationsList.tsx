import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  TextField,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Skeleton,
  IconButton,
  Tooltip,
  Typography,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import api from '../services/api';
import { Registration, Event } from '../types';
import { formatDate } from '../utils/format';
import { useNotification } from '../context/NotificationContext';

const ITEMS_PER_PAGE = 25;

interface FiltersState {
  eventId: number | '';
  search: string;
  paymentStatus: string;
  registrationStatus: string;
  dateFrom: string;
  dateTo: string;
}

const STORAGE_KEY = 'ftr_registrations_filters';

export const RegistrationsList: React.FC = () => {
  const { showError } = useNotification();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  
  // Load filters from localStorage
  const loadFilters = (): FiltersState => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading filters from localStorage:', error);
    }
    return {
      eventId: '',
      search: '',
      paymentStatus: '',
      registrationStatus: '',
      dateFrom: '',
      dateTo: '',
    };
  };

  const [filters, setFilters] = useState<FiltersState>(loadFilters);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>(filters.eventId || '');
  const [search, setSearch] = useState(filters.search || '');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(filters.paymentStatus || '');
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState(filters.registrationStatus || '');
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || '');
  const [dateTo, setDateTo] = useState(filters.dateTo || '');
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(ITEMS_PER_PAGE);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkMenuAnchor, setBulkMenuAnchor] = useState<null | HTMLElement>(null);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>('');
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  // Save filters to localStorage
  useEffect(() => {
    const filtersToSave: FiltersState = {
      eventId: selectedEventId,
      search,
      paymentStatus: paymentStatusFilter,
      registrationStatus: registrationStatusFilter,
      dateFrom,
      dateTo,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtersToSave));
    } catch (error) {
      console.error('Error saving filters to localStorage:', error);
    }
  }, [selectedEventId, search, paymentStatusFilter, registrationStatusFilter, dateFrom, dateTo]);

  // Загрузка событий
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

  // Загрузка регистраций
  const fetchRegistrations = useCallback(async () => {
    if (!selectedEventId) {
      setRegistrations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = {
        eventId: selectedEventId,
        page: page + 1,
        limit: rowsPerPage,
      };

      if (search) {
        params.search = search;
      }

      if (paymentStatusFilter) {
        params.paymentStatus = paymentStatusFilter;
      }

      if (registrationStatusFilter) {
        params.status = registrationStatusFilter;
      }

      if (dateFrom) {
        params.dateFrom = dateFrom;
      }

      if (dateTo) {
        params.dateTo = dateTo;
      }

      const response = await api.get('/api/registrations', { params });
      setRegistrations(response.data.registrations || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, page, rowsPerPage, search, paymentStatusFilter, registrationStatusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Debounce поиска
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    const timeout = setTimeout(() => {
      setPage(0);
    }, 300);
    setSearchDebounce(timeout);
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'success';
      case 'PERFORMANCE_PAID':
      case 'DIPLOMAS_PAID':
        return 'warning';
      case 'UNPAID':
        return 'error';
      default:
        return 'default';
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'Оплачено';
      case 'PERFORMANCE_PAID':
        return 'Выступление оплачено';
      case 'DIPLOMAS_PAID':
        return 'Дипломы оплачены';
      case 'UNPAID':
        return 'Не оплачено';
      default:
        return status;
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/api/statistics/export/excel', {
        params: { eventId: selectedEventId },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `registrations_${selectedEventId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error: any) {
      console.error('Error exporting:', error);
      showError(error.response?.data?.error || 'Ошибка экспорта');
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setPaymentStatusFilter('');
    setRegistrationStatusFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(0);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing filters from localStorage:', error);
    }
  };

  const hasActiveFilters = search || paymentStatusFilter || registrationStatusFilter || dateFrom || dateTo;

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const allIds = new Set(registrations.map((reg: any) => reg.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (selectedIds.size > 0) {
      setBulkMenuAnchor(event.currentTarget);
    }
  };

  const handleBulkMenuClose = () => {
    setBulkMenuAnchor(null);
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatusValue || selectedIds.size === 0) return;

    try {
      const updates = Array.from(selectedIds).map((id) =>
        api.patch(`/api/registrations/${id}`, { status: bulkStatusValue })
      );
      await Promise.all(updates);
      showSuccess(`Статус успешно изменен для ${selectedIds.size} регистраций`);
      setSelectedIds(new Set());
      setBulkStatusDialogOpen(false);
      setBulkStatusValue('');
      fetchRegistrations();
    } catch (error: any) {
      console.error('Error updating statuses:', error);
      showError(error.response?.data?.error || 'Ошибка изменения статусов');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Вы уверены, что хотите удалить ${selectedIds.size} регистраций?`)) return;

    try {
      const deletions = Array.from(selectedIds).map((id) => api.delete(`/api/registrations/${id}`));
      await Promise.all(deletions);
      showSuccess(`Успешно удалено ${selectedIds.size} регистраций`);
      setSelectedIds(new Set());
      fetchRegistrations();
    } catch (error: any) {
      console.error('Error deleting registrations:', error);
      showError(error.response?.data?.error || 'Ошибка удаления регистраций');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, mb: 3, gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
          <FormControl sx={{ minWidth: { xs: '100%', sm: 200 } }}>
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
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
            sx={{ minWidth: { xs: '100%', sm: 300 } }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
          <Tooltip title="Экспорт в Excel">
            <IconButton onClick={handleExport} disabled={!selectedEventId} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <FileDownloadIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/registrations/new')}
            fullWidth={window.innerWidth < 600}
            sx={{ minWidth: { xs: 'auto', sm: 120 } }}
          >
            Создать регистрацию
          </Button>
        </Box>
      </Box>

      {/* Расширенные фильтры */}
      <Accordion sx={{ mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FilterListIcon />
            <Typography>Расширенные фильтры</Typography>
            {hasActiveFilters && (
              <Chip
                label="Активны"
                color="primary"
                size="small"
                sx={{ ml: 1 }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Статус оплаты</InputLabel>
                <Select
                  value={paymentStatusFilter}
                  label="Статус оплаты"
                  onChange={(e) => {
                    setPaymentStatusFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">Все</MenuItem>
                  <MenuItem value="UNPAID">Не оплачено</MenuItem>
                  <MenuItem value="PERFORMANCE_PAID">Выступление оплачено</MenuItem>
                  <MenuItem value="DIPLOMAS_PAID">Дипломы оплачены</MenuItem>
                  <MenuItem value="PAID">Полностью оплачено</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Статус регистрации</InputLabel>
                <Select
                  value={registrationStatusFilter}
                  label="Статус регистрации"
                  onChange={(e) => {
                    setRegistrationStatusFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <MenuItem value="">Все</MenuItem>
                  <MenuItem value="PENDING">На рассмотрении</MenuItem>
                  <MenuItem value="APPROVED">Одобрено</MenuItem>
                  <MenuItem value="REJECTED">Отклонено</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Дата от"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(0);
                }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Дата до"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(0);
                }}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            {hasActiveFilters && (
              <Grid item xs={12}>
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  size="small"
                >
                  Очистить фильтры
                </Button>
              </Grid>
            )}
          </Grid>
        </AccordionDetails>
      </Accordion>

        <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'stretch', sm: 'flex-end' } }}>
          <Tooltip title="Экспорт в Excel">
            <IconButton onClick={handleExport} disabled={!selectedEventId} sx={{ width: { xs: '100%', sm: 'auto' } }}>
              <FileDownloadIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/registrations/new')}
            fullWidth={window.innerWidth < 600}
            sx={{ minWidth: { xs: 'auto', sm: 120 } }}
          >
            Создать регистрацию
          </Button>
        </Box>
      </Box>

      {/* Desktop table view */}
      <TableContainer component={Paper} sx={{ display: { xs: 'none', md: 'block' } }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedIds.size > 0 && selectedIds.size < registrations.length}
                  checked={registrations.length > 0 && selectedIds.size === registrations.length}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>№</TableCell>
              <TableCell>Коллектив</TableCell>
              <TableCell>Название танца</TableCell>
              <TableCell>Дисциплина</TableCell>
              <TableCell>Номинация</TableCell>
              <TableCell>Возраст</TableCell>
              <TableCell>Участников</TableCell>
              <TableCell>Статус оплаты</TableCell>
              <TableCell>Дата создания</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: rowsPerPage }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={9}>
                    <Skeleton height={40} />
                  </TableCell>
                </TableRow>
              ))
            ) : registrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  Нет регистраций
                </TableCell>
              </TableRow>
            ) : (
              registrations.map((reg: any) => (
                <TableRow
                  key={reg.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(reg.id)}
                      onChange={() => handleSelectOne(reg.id)}
                    />
                  </TableCell>
                  <TableCell onClick={() => navigate(`/registrations/${reg.id}`)}>{reg.number || '-'}</TableCell>
                  <TableCell onClick={() => navigate(`/registrations/${reg.id}`)}>{reg.collective?.name || '-'}</TableCell>
                  <TableCell onClick={() => navigate(`/registrations/${reg.id}`)}>{reg.danceName || '-'}</TableCell>
                  <TableCell onClick={() => navigate(`/registrations/${reg.id}`)}>{reg.discipline?.name || '-'}</TableCell>
                  <TableCell onClick={() => navigate(`/registrations/${reg.id}`)}>{reg.nomination?.name || '-'}</TableCell>
                  <TableCell onClick={() => navigate(`/registrations/${reg.id}`)}>{reg.age?.name || '-'}</TableCell>
                  <TableCell onClick={() => navigate(`/registrations/${reg.id}`)}>{reg.participantsCount || 0}</TableCell>
                  <TableCell onClick={() => navigate(`/registrations/${reg.id}`)}>
                    <Chip
                      label={getPaymentStatusLabel(reg.paymentStatus)}
                      color={getPaymentStatusColor(reg.paymentStatus) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell onClick={() => navigate(`/registrations/${reg.id}`)}>{formatDate(reg.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
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

      {/* Mobile card view */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {loading ? (
          Array.from({ length: rowsPerPage }).map((_, index) => (
            <Paper key={index} sx={{ p: 2, mb: 2 }}>
              <Skeleton height={60} />
            </Paper>
          ))
        ) : registrations.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography>Нет регистраций</Typography>
          </Paper>
        ) : (
          <>
            {registrations.map((reg: any) => (
              <Paper
                key={reg.id}
                sx={{ p: 2, mb: 2, cursor: 'pointer' }}
                onClick={() => navigate(`/registrations/${reg.id}`)}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                  <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                    {reg.collective?.name || '-'}
                  </Typography>
                  <Chip
                    label={getPaymentStatusLabel(reg.paymentStatus)}
                    color={getPaymentStatusColor(reg.paymentStatus) as any}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {reg.danceName || 'Без названия'}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  <Typography variant="caption">
                    №{reg.number || '-'} | {reg.discipline?.name || '-'} | {reg.nomination?.name || '-'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">
                    Участники: {reg.participantsCount || 0} | {formatDate(reg.createdAt)}
                  </Typography>
                </Box>
              </Paper>
            ))}
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
          </>
        )}
      </Box>

      {/* Диалог изменения статуса */}
      <Dialog open={bulkStatusDialogOpen} onClose={() => setBulkStatusDialogOpen(false)}>
        <DialogTitle>Изменить статус регистраций</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Новый статус</InputLabel>
            <Select
              value={bulkStatusValue}
              label="Новый статус"
              onChange={(e) => setBulkStatusValue(e.target.value)}
            >
              <MenuItem value="PENDING">На рассмотрении</MenuItem>
              <MenuItem value="APPROVED">Одобрено</MenuItem>
              <MenuItem value="REJECTED">Отклонено</MenuItem>
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Будет изменен статус для {selectedIds.size} регистраций
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkStatusDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleBulkStatusChange} variant="contained" disabled={!bulkStatusValue}>
            Применить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

