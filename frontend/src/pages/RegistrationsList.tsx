import React, { useState, useEffect, useCallback, memo, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Button,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Skeleton,
  IconButton,
  Tooltip,
  Typography,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import api from '../services/api';
import { Registration, Event } from '../types';
import { formatDate, formatRegistrationNumber } from '../utils/format';
import { useNotification } from '../context/NotificationContext';

const ITEMS_PER_PAGE = 25;

interface FiltersState {
  eventId: number | '';
  search: string;
  paymentStatus: string;
  dateFrom: string;
  dateTo: string;
}

const STORAGE_KEY = 'ftr_registrations_filters';

// Мемоизированный компонент строки таблицы для десктопа
const RegistrationTableRow = memo(({ 
  reg, 
  isSelected, 
  onSelect, 
  onNavigate 
}: { 
  reg: any; 
  isSelected: boolean; 
  onSelect: (id: number) => void; 
  onNavigate: (id: number) => void;
}) => {
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
        return 'Оплачено полностью';
      case 'PERFORMANCE_PAID':
        return 'Оплачено выступление';
      case 'DIPLOMAS_PAID':
        return 'Оплачены Д/М';
      case 'UNPAID':
        return 'Не оплачено';
      default:
        return status;
    }
  };

  return (
    <TableRow
      hover
      sx={{ cursor: 'pointer' }}
    >
      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onChange={() => onSelect(reg.id)}
        />
      </TableCell>
      <TableCell onClick={() => onNavigate(reg.id)}>
        {formatRegistrationNumber(reg)}
      </TableCell>
      <TableCell onClick={() => onNavigate(reg.id)}>{reg.collective?.name || '-'}</TableCell>
      <TableCell onClick={() => onNavigate(reg.id)}>{reg.danceName || '-'}</TableCell>
      <TableCell onClick={() => onNavigate(reg.id)}>{reg.discipline?.name || '-'}</TableCell>
      <TableCell onClick={() => onNavigate(reg.id)}>{reg.nomination?.name || '-'}</TableCell>
      <TableCell onClick={() => onNavigate(reg.id)}>{reg.age?.name || '-'}</TableCell>
      <TableCell onClick={() => onNavigate(reg.id)}>{reg.participantsCount || 0}</TableCell>
      <TableCell onClick={() => onNavigate(reg.id)}>
        <Chip
          label={getPaymentStatusLabel(reg.paymentStatus)}
          color={getPaymentStatusColor(reg.paymentStatus) as any}
          size="small"
        />
      </TableCell>
      <TableCell onClick={() => onNavigate(reg.id)}>
        {reg.notes ? (
          <Tooltip title={reg.notes}>
            <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {reg.notes}
            </Typography>
          </Tooltip>
        ) : (
          '-'
        )}
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => {
  // Кастомная функция сравнения для оптимизации
  return (
    prevProps.reg.id === nextProps.reg.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.reg.paymentStatus === nextProps.reg.paymentStatus &&
    prevProps.reg.notes === nextProps.reg.notes
  );
});

RegistrationTableRow.displayName = 'RegistrationTableRow';

// Мемоизированный компонент карточки для мобильной версии
const RegistrationCard = memo(({ 
  reg, 
  isSelected, 
  onSelect, 
  onNavigate 
}: { 
  reg: any; 
  isSelected: boolean; 
  onSelect: (id: number) => void; 
  onNavigate: (id: number) => void;
}) => {
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
        return 'Оплачено полностью';
      case 'PERFORMANCE_PAID':
        return 'Оплачено выступление';
      case 'DIPLOMAS_PAID':
        return 'Оплачены Д/М';
      case 'UNPAID':
        return 'Не оплачено';
      default:
        return status;
    }
  };

  return (
    <Paper
      sx={{
        p: 2,
        mb: 2,
        cursor: 'pointer',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)'
        }
      }}
      onClick={() => onNavigate(reg.id)}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            {reg.collective?.name || '-'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {reg.danceName || '-'}
          </Typography>
          <Typography variant="caption">
            №{formatRegistrationNumber(reg)} | {reg.discipline?.name || '-'} | {reg.nomination?.name || '-'}
          </Typography>
        </Box>
        <Checkbox
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(reg.id);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: reg.notes ? 1 : 0 }}>
        <Typography variant="body2">
          Участники: {reg.participantsCount || 0}
        </Typography>
        <Chip
          label={getPaymentStatusLabel(reg.paymentStatus)}
          color={getPaymentStatusColor(reg.paymentStatus) as any}
          size="small"
        />
      </Box>
      {reg.notes && (
        <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            📝 {reg.notes}
          </Typography>
        </Box>
      )}
    </Paper>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.reg.id === nextProps.reg.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.reg.paymentStatus === nextProps.reg.paymentStatus &&
    prevProps.reg.notes === nextProps.reg.notes &&
    prevProps.reg.collective?.name === nextProps.reg.collective?.name &&
    prevProps.reg.danceName === nextProps.reg.danceName
  );
});

RegistrationCard.displayName = 'RegistrationCard';

export const RegistrationsList: React.FC = () => {
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
      dateFrom: '',
      dateTo: '',
    };
  };

  const [filters] = useState<FiltersState>(loadFilters);
  const [selectedEventId, setSelectedEventId] = useState<number | ''>(filters.eventId || '');
  const [search, setSearch] = useState(filters.search || '');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState(filters.paymentStatus || '');
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || '');
  const [dateTo, setDateTo] = useState(filters.dateTo || '');

  const [loading, setLoading] = useState(true);
  const [searchDebounce, setSearchDebounce] = useState<NodeJS.Timeout | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkMenuAnchor, setBulkMenuAnchor] = useState<null | HTMLElement>(null);
  const [bulkStatusDialogOpen, setBulkStatusDialogOpen] = useState(false);
  const [bulkStatusValue, setBulkStatusValue] = useState<string>('');
  const [orderBy, setOrderBy] = useState<string | null>(null);
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  // Refs для виртуализации мобильной версии
  const mobileListRef = useRef<HTMLDivElement>(null);
  
  // Мемоизируем отсортированный список регистраций
  const sortedRegistrations = useMemo(() => {
    if (!orderBy) return registrations;
    
    return [...registrations].sort((a: any, b: any) => {
      const direction = order === 'asc' ? 1 : -1;
      const getValue = (reg: any) => {
        switch (orderBy) {
          case 'number':
            return reg.number || 0;
          case 'collective':
            return reg.collective?.name || '';
          case 'danceName':
            return reg.danceName || '';
          case 'discipline':
            return reg.discipline?.name || '';
          case 'nomination':
            return reg.nomination?.name || '';
          case 'age':
            return reg.age?.name || '';
          case 'participantsCount':
            return reg.participantsCount || 0;
          case 'paymentStatus':
            return reg.paymentStatus || '';
          default:
            return '';
        }
      };
      const aVal = getValue(a);
      const bVal = getValue(b);
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * direction;
      }
      return String(aVal).localeCompare(String(bVal)) * direction;
    });
  }, [registrations, orderBy, order]);

  // Виртуализатор для мобильной версии (только если больше 50 элементов)
  const mobileVirtualizer = useVirtualizer({
    count: sortedRegistrations.length,
    getScrollElement: () => mobileListRef.current,
    estimateSize: () => 120, // Примерная высота карточки
    overscan: 5, // Рендерим 5 дополнительных элементов для плавности
  });

  // Save filters to localStorage
  useEffect(() => {
    const filtersToSave: FiltersState = {
      eventId: selectedEventId,
      search,
      paymentStatus: paymentStatusFilter,
      dateFrom,
      dateTo,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtersToSave));
    } catch (error) {
      console.error('Error saving filters to localStorage:', error);
    }
  }, [selectedEventId, search, paymentStatusFilter, dateFrom, dateTo]);

  // Загрузка событий
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // Загружаем все события (ACTIVE, DRAFT, ARCHIVED), чтобы видеть все регистрации
        const response = await api.get('/api/reference/events');
        setEvents(response.data);
        if (response.data.length > 0 && !selectedEventId) {
          // Предпочитаем ACTIVE события, но если их нет, выбираем первое доступное
          const activeEvent = response.data.find((e: Event) => e.status === 'ACTIVE');
          setSelectedEventId(activeEvent ? activeEvent.id : response.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching events:', error);
        showError('Не удалось загрузить список событий');
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
        // Загружаем все регистрации для события за один запрос
        limit: 100000,
      };

      if (search) {
        params.search = search;
      }

      if (paymentStatusFilter) {
        params.paymentStatus = paymentStatusFilter;
      }

      if (dateFrom) {
        params.dateFrom = dateFrom;
      }

      if (dateTo) {
        params.dateTo = dateTo;
      }

      const response = await api.get('/api/registrations', { params });
      const regs = response.data.registrations || [];
      console.log(`[RegistrationsList] Loaded ${regs.length} registrations for event ${selectedEventId}`);
      console.log('[RegistrationsList] Response data:', response.data);
      setRegistrations(regs);
      
      if (regs.length === 0 && selectedEventId) {
        console.warn(`[RegistrationsList] No registrations found for event ${selectedEventId}`);
        // Показываем предупреждение только если событие выбрано и данных нет
        if (response.data.pagination?.total === 0) {
          console.warn('[RegistrationsList] Total registrations in response: 0');
        }
      }
    } catch (error: any) {
      console.error('Error fetching registrations:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      showError(error.response?.data?.error || 'Не удалось загрузить регистрации');
      setRegistrations([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, search, paymentStatusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  // Debounce поиска
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchDebounce) {
      clearTimeout(searchDebounce);
      setSearchDebounce(null);
    }
    
    // Если поиск очищен, сразу загружаем данные без debounce
    if (value === '') {
      // Используем setTimeout с 0, чтобы дать React обновить состояние
      setTimeout(() => {
        fetchRegistrations();
      }, 0);
    } else {
      // Для непустого поиска используем debounce
      const timeout = setTimeout(() => {
        fetchRegistrations();
        setSearchDebounce(null);
      }, 300);
      setSearchDebounce(timeout);
    }
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
        return 'Оплачено полностью';
      case 'PERFORMANCE_PAID':
        return 'Оплачено выступление';
      case 'DIPLOMAS_PAID':
        return 'Оплачены Д/М';
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
    setDateFrom('');
    setDateTo('');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing filters from localStorage:', error);
    }
  };

  const hasActiveFilters = search || paymentStatusFilter || dateFrom || dateTo;

  const handleRequestSort = (property: string) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

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

  // Bulk delete handler (kept for future use)
  // const handleBulkDelete = async () => {
  //   if (selectedIds.size === 0) return;
  //   if (!window.confirm(`Вы уверены, что хотите удалить ${selectedIds.size} регистраций?`)) return;

  //   try {
  //     const deletions = Array.from(selectedIds).map((id) => api.delete(`/api/registrations/${id}`));
  //     await Promise.all(deletions);
  //     showSuccess(`Успешно удалено ${selectedIds.size} регистраций`);
  //     setSelectedIds(new Set());
  //     fetchRegistrations();
  //   } catch (error: any) {
  //     console.error('Error deleting registrations:', error);
  //     showError(error.response?.data?.error || 'Ошибка удаления регистраций');
  //   }
  // };

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
              <TextField
                fullWidth
                label="Дата от"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
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
              <TableCell sortDirection={orderBy === 'number' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'number'}
                  direction={orderBy === 'number' ? order : 'asc'}
                  onClick={() => handleRequestSort('number')}
                >
                  №
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'collective' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'collective'}
                  direction={orderBy === 'collective' ? order : 'asc'}
                  onClick={() => handleRequestSort('collective')}
                >
                  Коллектив
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'danceName' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'danceName'}
                  direction={orderBy === 'danceName' ? order : 'asc'}
                  onClick={() => handleRequestSort('danceName')}
                >
                  Название танца
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'discipline' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'discipline'}
                  direction={orderBy === 'discipline' ? order : 'asc'}
                  onClick={() => handleRequestSort('discipline')}
                >
                  Дисциплина
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'nomination' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'nomination'}
                  direction={orderBy === 'nomination' ? order : 'asc'}
                  onClick={() => handleRequestSort('nomination')}
                >
                  Номинация
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'age' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'age'}
                  direction={orderBy === 'age' ? order : 'asc'}
                  onClick={() => handleRequestSort('age')}
                >
                  Возраст
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'participantsCount' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'participantsCount'}
                  direction={orderBy === 'participantsCount' ? order : 'asc'}
                  onClick={() => handleRequestSort('participantsCount')}
                >
                  Участников
                </TableSortLabel>
              </TableCell>
              <TableCell sortDirection={orderBy === 'paymentStatus' ? order : false}>
                <TableSortLabel
                  active={orderBy === 'paymentStatus'}
                  direction={orderBy === 'paymentStatus' ? order : 'asc'}
                  onClick={() => handleRequestSort('paymentStatus')}
                >
                  Статус оплаты
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={10}>
                    <Skeleton height={40} />
                  </TableCell>
                </TableRow>
              ))
            ) : registrations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                  Нет регистраций
                </TableCell>
              </TableRow>
            ) : (
              [...registrations]
                .sort((a: any, b: any) => {
                  if (!orderBy) return 0;
                  const direction = order === 'asc' ? 1 : -1;
                  const getValue = (reg: any) => {
                    switch (orderBy) {
                      case 'number':
                        return reg.number || 0;
                      case 'collective':
                        return reg.collective?.name || '';
                      case 'danceName':
                        return reg.danceName || '';
                      case 'discipline':
                        return reg.discipline?.name || '';
                      case 'nomination':
                        return reg.nomination?.name || '';
                      case 'age':
                        return reg.age?.name || '';
                      case 'participantsCount':
                        return reg.participantsCount || 0;
                      case 'paymentStatus':
                        return reg.paymentStatus || '';
                      default:
                        return '';
                    }
                  };
                  const aVal = getValue(a);
                  const bVal = getValue(b);
                  if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return (aVal - bVal) * direction;
                  }
                  return String(aVal).localeCompare(String(bVal)) * direction;
                })
                .map((reg: any) => (
                  <RegistrationTableRow
                    key={reg.id}
                    reg={reg}
                    isSelected={selectedIds.has(reg.id)}
                    onSelect={handleSelectOne}
                    onNavigate={(id) => navigate(`/registrations/${id}`)}
                  />
                ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Mobile card view */}
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        {loading ? (
          Array.from({ length: ITEMS_PER_PAGE }).map((_, index) => (
            <Paper key={index} sx={{ p: 2, mb: 2 }}>
              <Skeleton height={60} />
            </Paper>
          ))
        ) : registrations.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              {selectedEventId ? `Нет регистраций для выбранного события` : 'Выберите событие для просмотра регистраций'}
            </Typography>
            {selectedEventId && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Проверьте фильтры или выберите другое событие
              </Typography>
            )}
          </Paper>
        ) : (
          <>
            {registrations.map((reg: any) => (
              <RegistrationCard
                key={reg.id}
                reg={reg}
                isSelected={selectedIds.has(reg.id)}
                onSelect={handleSelectOne}
                onNavigate={(id) => navigate(`/registrations/${id}`)}
              />
            ))}
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

