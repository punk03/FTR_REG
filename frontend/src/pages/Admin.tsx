import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Alert,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import api from '../services/api';
import { User, Event } from '../types';
import { formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DiscountTiersEditor } from '../components/DiscountTiersEditor';
import { ExcelImportDialog } from '../components/ExcelImportDialog';

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

interface SettingCategory {
  id: string;
  name: string;
  description: string;
  settings: SettingItem[];
}

interface SettingItem {
  key: string;
  label: string;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea';
  defaultValue: any;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

const SETTING_CATEGORIES: SettingCategory[] = [
  {
    id: 'diplomas',
    name: 'Дипломы и медали',
    description: 'Настройки работы с дипломами и медалями',
    settings: [
      {
        key: 'diploma_cancel_timeout_minutes',
        label: 'Время отмены оплаты дипломов (минуты)',
        description: 'Время в минутах, в течение которого регистратор может отменить оплату дипломов',
        type: 'number',
        defaultValue: 5,
        min: 0,
        max: 1440,
      },
    ],
  },
  {
    id: 'notifications',
    name: 'Уведомления',
    description: 'Настройки email уведомлений',
    settings: [
      {
        key: 'email_enabled',
        label: 'Включить email уведомления',
        description: 'Включить отправку email уведомлений пользователям',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'email_notify_registration_created',
        label: 'Уведомлять о создании регистрации',
        description: 'Отправлять email при создании новой регистрации',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'email_notify_payment_created',
        label: 'Уведомлять о создании оплаты',
        description: 'Отправлять email при создании оплаты',
        type: 'boolean',
        defaultValue: true,
      },
      {
        key: 'email_notify_status_changed',
        label: 'Уведомлять об изменении статуса',
        description: 'Отправлять email при изменении статуса регистрации',
        type: 'boolean',
        defaultValue: true,
      },
    ],
  },
  {
    id: 'interface',
    name: 'Интерфейс',
    description: 'Настройки пользовательского интерфейса',
    settings: [
      {
        key: 'default_items_per_page',
        label: 'Записей на странице по умолчанию',
        description: 'Количество записей на странице в списках по умолчанию',
        type: 'select',
        defaultValue: 25,
        options: [
          { value: '10', label: '10' },
          { value: '25', label: '25' },
          { value: '50', label: '50' },
          { value: '100', label: '100' },
        ],
      },
      {
        key: 'search_debounce_ms',
        label: 'Задержка поиска (миллисекунды)',
        description: 'Время задержки перед выполнением поиска при вводе текста',
        type: 'number',
        defaultValue: 300,
        min: 100,
        max: 2000,
        step: 100,
      },
      {
        key: 'statistics_refresh_interval_ms',
        label: 'Интервал обновления статистики (миллисекунды)',
        description: 'Интервал автоматического обновления статистики на странице',
        type: 'number',
        defaultValue: 30000,
        min: 5000,
        max: 300000,
        step: 5000,
      },
      {
        key: 'default_language',
        label: 'Язык по умолчанию',
        description: 'Язык интерфейса по умолчанию',
        type: 'select',
        defaultValue: 'ru',
        options: [
          { value: 'ru', label: 'Русский' },
          { value: 'en', label: 'English' },
        ],
      },
    ],
  },
  {
    id: 'security',
    name: 'Безопасность',
    description: 'Настройки безопасности и ограничений',
    settings: [
      {
        key: 'rate_limit_auth_window_ms',
        label: 'Окно ограничения авторизации (миллисекунды)',
        description: 'Временное окно для ограничения попыток входа',
        type: 'number',
        defaultValue: 900000,
        min: 60000,
        max: 3600000,
        step: 60000,
      },
      {
        key: 'rate_limit_auth_max',
        label: 'Максимум попыток входа',
        description: 'Максимальное количество попыток входа в указанном окне',
        type: 'number',
        defaultValue: 5,
        min: 1,
        max: 20,
      },
      {
        key: 'rate_limit_payment_window_ms',
        label: 'Окно ограничения оплат (миллисекунды)',
        description: 'Временное окно для ограничения создания оплат',
        type: 'number',
        defaultValue: 60000,
        min: 60000,
        max: 600000,
        step: 60000,
      },
      {
        key: 'rate_limit_payment_max',
        label: 'Максимум оплат в окне',
        description: 'Максимальное количество созданий оплат в указанном окне',
        type: 'number',
        defaultValue: 10,
        min: 1,
        max: 100,
      },
      {
        key: 'rate_limit_import_window_ms',
        label: 'Окно ограничения импорта (миллисекунды)',
        description: 'Временное окно для ограничения импорта Excel',
        type: 'number',
        defaultValue: 300000,
        min: 60000,
        max: 1800000,
        step: 60000,
      },
      {
        key: 'rate_limit_import_max',
        label: 'Максимум импортов в окне',
        description: 'Максимальное количество импортов Excel в указанном окне',
        type: 'number',
        defaultValue: 3,
        min: 1,
        max: 20,
      },
      {
        key: 'rate_limit_api_window_ms',
        label: 'Окно ограничения API (миллисекунды)',
        description: 'Временное окно для ограничения общих API запросов',
        type: 'number',
        defaultValue: 60000,
        min: 10000,
        max: 300000,
        step: 10000,
      },
      {
        key: 'rate_limit_api_max',
        label: 'Максимум API запросов в окне',
        description: 'Максимальное количество API запросов в указанном окне',
        type: 'number',
        defaultValue: 100,
        min: 10,
        max: 1000,
      },
      {
        key: 'password_min_length',
        label: 'Минимальная длина пароля',
        description: 'Минимальное количество символов в пароле пользователя',
        type: 'number',
        defaultValue: 6,
        min: 4,
        max: 32,
      },
    ],
  },
  {
    id: 'export',
    name: 'Экспорт данных',
    description: 'Настройки экспорта данных в различные форматы',
    settings: [
      {
        key: 'export_excel_max_rows',
        label: 'Максимум строк в Excel экспорте',
        description: 'Максимальное количество строк для экспорта в Excel',
        type: 'number',
        defaultValue: 10000,
        min: 100,
        max: 100000,
        step: 1000,
      },
      {
        key: 'export_csv_max_rows',
        label: 'Максимум строк в CSV экспорте',
        description: 'Максимальное количество строк для экспорта в CSV',
        type: 'number',
        defaultValue: 10000,
        min: 100,
        max: 100000,
        step: 1000,
      },
      {
        key: 'export_pdf_page_size',
        label: 'Размер страницы PDF',
        description: 'Размер страницы для экспорта в PDF',
        type: 'select',
        defaultValue: 'A4',
        options: [
          { value: 'A4', label: 'A4' },
          { value: 'A3', label: 'A3' },
          { value: 'Letter', label: 'Letter' },
        ],
      },
    ],
  },
  {
    id: 'backup',
    name: 'Резервное копирование',
    description: 'Настройки автоматического резервного копирования',
    settings: [
      {
        key: 'backup_enabled',
        label: 'Включить автоматическое резервное копирование',
        description: 'Автоматически создавать резервные копии базы данных',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'backup_interval_hours',
        label: 'Интервал резервного копирования (часы)',
        description: 'Интервал между автоматическими резервными копиями',
        type: 'number',
        defaultValue: 24,
        min: 1,
        max: 168,
      },
      {
        key: 'backup_retention_days',
        label: 'Хранить резервные копии (дней)',
        description: 'Количество дней хранения резервных копий',
        type: 'number',
        defaultValue: 30,
        min: 1,
        max: 365,
      },
    ],
  },
  {
    id: 'excel_import',
    name: 'Импорт Excel',
    description: 'Настройки импорта данных из Excel',
    settings: [
      {
        key: 'excel_import_max_file_size_mb',
        label: 'Максимальный размер файла Excel (МБ)',
        description: 'Максимальный размер загружаемого Excel файла',
        type: 'number',
        defaultValue: 100,
        min: 1,
        max: 500,
      },
      {
        key: 'excel_import_preview_rows',
        label: 'Количество строк в предпросмотре',
        description: 'Количество строк для отображения в предпросмотре импорта',
        type: 'number',
        defaultValue: 100,
        min: 10,
        max: 1000,
      },
    ],
  },
];

export const Admin: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [userFormData, setUserFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'REGISTRATOR' as User['role'],
    city: '',
    phone: '',
  });
  const [eventFormData, setEventFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    status: 'DRAFT' as 'DRAFT' | 'ACTIVE' | 'ARCHIVED',
    isOnline: false,
    paymentEnable: true,
    categoryEnable: false,
    songEnable: false,
    durationMax: '',
    pricePerDiploma: '',
    pricePerMedal: '',
    discountTiers: '',
  });
  const [systemSettings, setSystemSettings] = useState<Record<string, any>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [deleteUserConfirmOpen, setDeleteUserConfirmOpen] = useState(false);
  const [deleteEventConfirmOpen, setDeleteEventConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);
  const [excelImportOpen, setExcelImportOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [priceEvent, setPriceEvent] = useState<Event | null>(null);
  const [priceRows, setPriceRows] = useState<
    Array<{
      nominationId: number;
      nominationName: string;
      pricePerParticipant: string;
      pricePerFederationParticipant: string;
    }>
  >([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceSaving, setPriceSaving] = useState(false);
  const [importErrors, setImportErrors] = useState<any[]>([]);
  const [selectedEventForErrors, setSelectedEventForErrors] = useState<number | ''>('');
  const [editingError, setEditingError] = useState<any | null>(null);
  const [errorEditFormData, setErrorEditFormData] = useState<any>({});
  const [importErrorsLoading, setImportErrorsLoading] = useState(false);
  const [errorEditDisciplines, setErrorEditDisciplines] = useState<any[]>([]);
  const [errorEditNominations, setErrorEditNominations] = useState<any[]>([]);
  const [errorEditAges, setErrorEditAges] = useState<any[]>([]);
  const [errorEditCategories, setErrorEditCategories] = useState<any[]>([]);
  
  // Справочники
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [nominations, setNominations] = useState<any[]>([]);
  const [ages, setAges] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<any | null>(null);
  const [editingNomination, setEditingNomination] = useState<any | null>(null);
  const [editingAge, setEditingAge] = useState<any | null>(null);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [disciplineFormData, setDisciplineFormData] = useState({
    name: '',
    abbreviations: [] as string[],
    variants: [] as string[],
  });
  const [nominationFormData, setNominationFormData] = useState({ name: '' });
  const [ageFormData, setAgeFormData] = useState({ name: '' });
  const [categoryFormData, setCategoryFormData] = useState({ name: '' });
  const [newAbbreviation, setNewAbbreviation] = useState('');
  const [newVariant, setNewVariant] = useState('');
  const [showDisciplineDialog, setShowDisciplineDialog] = useState(false);

  useEffect(() => {
    if (tabValue === 0) {
      fetchUsers();
    } else if (tabValue === 1) {
      fetchEvents();
    } else if (tabValue === 2) {
      // Загружаем события, если они еще не загружены
      if (events.length === 0) {
        fetchEvents();
      }
      // Ошибки импорта загружаются при выборе события
      // Если уже выбрано мероприятие, загружаем ошибки снова
      if (selectedEventForErrors) {
        fetchImportErrors(selectedEventForErrors);
      }
    } else if (tabValue === 3) {
      fetchReferences();
    } else if (tabValue === 4) {
      fetchSettings();
    }
  }, [tabValue]);

  // Отдельный useEffect для автоматической загрузки ошибок при открытии вкладки "Ошибки импорта"
  useEffect(() => {
    if (tabValue === 2 && selectedEventForErrors) {
      // Загружаем ошибки при открытии вкладки, если мероприятие уже выбрано
      fetchImportErrors(selectedEventForErrors);
    }
  }, [tabValue]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/admin/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/reference/events');
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPricesDialog = async (event: Event) => {
    setPriceEvent(event);
    setPriceDialogOpen(true);
    setPriceLoading(true);
    try {
      const [nominationsRes, pricesRes] = await Promise.all([
        api.get('/api/reference/nominations'),
        api.get(`/api/events/${event.id}/prices`),
      ]);
      // Фильтруем устаревшие номинации "Трио" и "Квартет" — все мелкие составы относятся к "Малая группа"
      const nominations = (nominationsRes.data || []).filter((nom: any) => {
        const name = String(nom.name || '').toLowerCase();
        return !name.includes('трио') && !name.includes('квартет');
      });
      const prices = pricesRes.data || [];

      const rows = nominations.map((nom: any) => {
        const existing = prices.find((p: any) => p.nominationId === nom.id) || {};
        return {
          nominationId: nom.id,
          nominationName: nom.name,
          pricePerParticipant:
            existing.pricePerParticipant !== undefined && existing.pricePerParticipant !== null
              ? String(existing.pricePerParticipant)
              : '',
          pricePerFederationParticipant:
            existing.pricePerFederationParticipant !== undefined && existing.pricePerFederationParticipant !== null
              ? String(existing.pricePerFederationParticipant)
              : '',
        };
      });
      setPriceRows(rows);
    } catch (error) {
      console.error('Error loading event prices:', error);
      showError('Не удалось загрузить цены для мероприятия');
    } finally {
      setPriceLoading(false);
    }
  };

  const handleSavePrices = async () => {
    if (!priceEvent) return;
    setPriceSaving(true);
    try {
      const pricesPayload = priceRows
        .filter(
          (row) =>
            row.pricePerParticipant !== '' || row.pricePerFederationParticipant !== ''
        )
        .map((row) => ({
          nominationId: row.nominationId,
          pricePerParticipant: parseInt(row.pricePerParticipant || '0', 10),
          pricePerFederationParticipant:
            row.pricePerFederationParticipant !== ''
              ? parseInt(row.pricePerFederationParticipant, 10)
              : undefined,
        }));

      await api.put(`/api/events/${priceEvent.id}/prices`, {
        prices: pricesPayload,
      });

      showSuccess('Цены по номинациям сохранены');
      setPriceDialogOpen(false);
      setPriceEvent(null);
    } catch (error: any) {
      console.error('Error saving prices:', error);
      showError(error.response?.data?.error || 'Ошибка сохранения цен');
    } finally {
      setPriceSaving(false);
    }
  };

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const response = await api.get('/api/admin/settings');
      setSystemSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSetting = async (key: string, value: any, description?: string) => {
    try {
      const setting = SETTING_CATEGORIES.flatMap((cat) => cat.settings).find((s) => s.key === key);
      const settingDescription = description || setting?.description || '';

      await api.put(`/api/admin/settings/${key}`, {
        value,
        description: settingDescription,
      });

      setSystemSettings({
        ...systemSettings,
        [key]: value,
      });

      showSuccess(`Настройка "${setting?.label || key}" сохранена`);
    } catch (error: any) {
      console.error('Error saving setting:', error);
      showError(error.response?.data?.error || 'Ошибка сохранения настройки');
    }
  };

  const handleSaveUser = async () => {
    try {
      if (selectedUser) {
        await api.put(`/api/admin/users/${selectedUser.id}`, userFormData);
        showSuccess('Пользователь обновлен');
      } else {
        await api.post('/api/admin/users', userFormData);
        showSuccess('Пользователь создан');
      }
      setUserDialogOpen(false);
      setSelectedUser(null);
      setUserFormData({
        name: '',
        email: '',
        password: '',
        role: 'REGISTRATOR',
        city: '',
        phone: '',
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      showError(error.response?.data?.error || 'Ошибка сохранения пользователя');
    }
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setUserFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      city: user.city || '',
      phone: user.phone || '',
    });
    setUserDialogOpen(true);
  };

  const handleDeleteUserClick = (userId: number) => {
    setUserToDelete(userId);
    setDeleteUserConfirmOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/api/admin/users/${userToDelete}`);
      showSuccess('Пользователь удален');
      setDeleteUserConfirmOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      showError(error.response?.data?.error || 'Ошибка удаления пользователя');
    }
  };

  const handleSaveEvent = async () => {
    try {
      if (selectedEvent) {
        await api.put(`/api/events/${selectedEvent.id}`, eventFormData);
        showSuccess('Мероприятие обновлено');
      } else {
        await api.post('/api/events', eventFormData);
        showSuccess('Мероприятие создано');
      }
      setEventDialogOpen(false);
      setSelectedEvent(null);
      setEventFormData({
        name: '',
        startDate: '',
        endDate: '',
        status: 'DRAFT',
        isOnline: false,
        paymentEnable: true,
        categoryEnable: false,
        songEnable: false,
        durationMax: '',
        pricePerDiploma: '',
        pricePerMedal: '',
        discountTiers: '',
      });
      fetchEvents();
    } catch (error: any) {
      console.error('Error saving event:', error);
      showError(error.response?.data?.error || 'Ошибка сохранения мероприятия');
    }
  };

  const handleEditEvent = (event: Event) => {
    setSelectedEvent(event);
    setEventFormData({
      name: event.name,
      startDate: event.startDate.split('T')[0],
      endDate: event.endDate.split('T')[0],
      status: event.status,
      isOnline: event.isOnline,
      paymentEnable: event.paymentEnable,
      categoryEnable: event.categoryEnable,
      songEnable: event.songEnable,
      durationMax: String(event.durationMax),
      pricePerDiploma: event.pricePerDiploma ? String(event.pricePerDiploma) : '',
      pricePerMedal: event.pricePerMedal ? String(event.pricePerMedal) : '',
      discountTiers: event.discountTiers || '',
    });
    setEventDialogOpen(true);
  };

  const handleDuplicateEvent = async (eventId: number) => {
    try {
      await api.post(`/api/events/${eventId}/duplicate`);
      showSuccess('Мероприятие продублировано');
      fetchEvents();
    } catch (error: any) {
      console.error('Error duplicating event:', error);
      showError(error.response?.data?.error || 'Ошибка дублирования мероприятия');
    }
  };

  const fetchImportErrors = async (eventId: number) => {
    setImportErrorsLoading(true);
    try {
      console.log(`[Admin] Fetching import errors for eventId: ${eventId}`);
      const response = await api.get(`/api/events/${eventId}/import-errors`);
      console.log(`[Admin] Received import errors:`, response.data);
      
      if (Array.isArray(response.data)) {
        setImportErrors(response.data);
        if (response.data.length === 0) {
          console.log(`[Admin] No import errors found for eventId: ${eventId}`);
        }
      } else {
        console.error('[Admin] Invalid response format:', response.data);
        setImportErrors([]);
        showError('Неверный формат ответа от сервера');
      }
    } catch (error: any) {
      console.error('[Admin] Error fetching import errors:', error);
      console.error('[Admin] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });
      
      const errorMessage = error.response?.data?.error || error.message || 'Ошибка загрузки ошибок импорта';
      showError(errorMessage);
      setImportErrors([]);
    } finally {
      setImportErrorsLoading(false);
    }
  };

  const handleImportError = async (errorId: number) => {
    if (!selectedEventForErrors) return;
    try {
      await api.post(`/api/events/${selectedEventForErrors}/import-errors/${errorId}/import`);
      showSuccess('Запись успешно импортирована');
      fetchImportErrors(selectedEventForErrors);
    } catch (error: any) {
      console.error('Error importing error:', error);
      showError(error.response?.data?.error || 'Ошибка импорта записи');
    }
  };

  const handleDeleteImportError = async (errorId: number) => {
    if (!selectedEventForErrors) return;
    try {
      await api.delete(`/api/events/${selectedEventForErrors}/import-errors/${errorId}`);
      showSuccess('Запись с ошибкой удалена');
      fetchImportErrors(selectedEventForErrors);
    } catch (error: any) {
      console.error('Error deleting import error:', error);
      showError(error.response?.data?.error || 'Ошибка удаления записи');
    }
  };

  const handleEditImportError = async (error: any) => {
    setEditingError(error);
    
    // Загружаем справочники для выпадающих списков
    try {
      const [disciplinesRes, nominationsRes, agesRes, categoriesRes] = await Promise.all([
        api.get('/api/reference/disciplines'),
        api.get('/api/reference/nominations'),
        api.get('/api/reference/ages'),
        api.get('/api/reference/categories'),
      ]);
      
      setErrorEditDisciplines(disciplinesRes.data);
      setErrorEditNominations(nominationsRes.data);
      setErrorEditAges(agesRes.data);
      setErrorEditCategories(categoriesRes.data);
      
      // Находим ID по именам для предзаполнения
      const discipline = disciplinesRes.data.find((d: any) => d.name === error.rowData?.parsed?.disciplineName);
      const nomination = nominationsRes.data.find((n: any) => n.name === error.rowData?.parsed?.nominationName);
      const age = agesRes.data.find((a: any) => a.name === error.rowData?.parsed?.ageName);
      const category = categoriesRes.data.find((c: any) => c.name === error.rowData?.parsed?.categoryName);
      
      setErrorEditFormData({
        categoryString: error.rowData?.categoryString || '',
        collective: error.rowData?.collective || '',
        danceName: error.rowData?.danceName || '',
        participantsCount: error.rowData?.participantsCount || 0,
        federationParticipantsCount: error.rowData?.federationParticipantsCount || 0,
        leaders: error.rowData?.leaders || '',
        trainers: error.rowData?.trainers || '',
        school: error.rowData?.school || '',
        contacts: error.rowData?.contacts || '',
        city: error.rowData?.city || '',
        duration: error.rowData?.duration || '',
        videoUrl: error.rowData?.videoUrl || '',
        diplomasList: error.rowData?.diplomasList || '',
        medalsCount: error.rowData?.medalsCount || 0,
        blockNumber: error.rowData?.parsed?.blockNumber || '',
        disciplineId: discipline ? String(discipline.id) : '',
        disciplineName: error.rowData?.parsed?.disciplineName || '',
        nominationId: nomination ? String(nomination.id) : '',
        nominationName: error.rowData?.parsed?.nominationName || '',
        ageId: age ? String(age.id) : '',
        ageName: error.rowData?.parsed?.ageName || '',
        categoryId: category ? String(category.id) : '',
        categoryName: error.rowData?.parsed?.categoryName || '',
      });
    } catch (error: any) {
      console.error('Error loading reference data:', error);
      // Устанавливаем данные без справочников
      setErrorEditFormData({
        categoryString: error.rowData?.categoryString || '',
        collective: error.rowData?.collective || '',
        danceName: error.rowData?.danceName || '',
        participantsCount: error.rowData?.participantsCount || 0,
        federationParticipantsCount: error.rowData?.federationParticipantsCount || 0,
        leaders: error.rowData?.leaders || '',
        trainers: error.rowData?.trainers || '',
        school: error.rowData?.school || '',
        contacts: error.rowData?.contacts || '',
        city: error.rowData?.city || '',
        duration: error.rowData?.duration || '',
        videoUrl: error.rowData?.videoUrl || '',
        diplomasList: error.rowData?.diplomasList || '',
        medalsCount: error.rowData?.medalsCount || 0,
        blockNumber: error.rowData?.parsed?.blockNumber || '',
        disciplineId: '',
        disciplineName: error.rowData?.parsed?.disciplineName || '',
        nominationId: '',
        nominationName: error.rowData?.parsed?.nominationName || '',
        ageId: '',
        ageName: error.rowData?.parsed?.ageName || '',
        categoryId: '',
        categoryName: error.rowData?.parsed?.categoryName || '',
      });
    }
  };

  const handleParseCategoryString = async (categoryString: string) => {
    if (!categoryString || !selectedEventForErrors) return;
    
    try {
      const response = await api.post('/api/excel-import/parse-category', {
        categoryString,
      });
      
      const parsed = response.data;
      
      // Обновляем форму с распознанными значениями
      if (parsed.disciplineName) {
        const discipline = errorEditDisciplines.find((d: any) => d.name === parsed.disciplineName);
        if (discipline) {
          setErrorEditFormData((prev: any) => ({
            ...prev,
            disciplineId: String(discipline.id),
            disciplineName: parsed.disciplineName,
          }));
        }
      }
      
      if (parsed.nominationName) {
        const nomination = errorEditNominations.find((n: any) => n.name === parsed.nominationName);
        if (nomination) {
          setErrorEditFormData((prev: any) => ({
            ...prev,
            nominationId: String(nomination.id),
            nominationName: parsed.nominationName,
          }));
        }
      }
      
      if (parsed.ageName) {
        const age = errorEditAges.find((a: any) => a.name === parsed.ageName);
        if (age) {
          setErrorEditFormData((prev: any) => ({
            ...prev,
            ageId: String(age.id),
            ageName: parsed.ageName,
          }));
        }
      }
      
      if (parsed.categoryName) {
        const category = errorEditCategories.find((c: any) => c.name === parsed.categoryName);
        if (category) {
          setErrorEditFormData((prev: any) => ({
            ...prev,
            categoryId: String(category.id),
            categoryName: parsed.categoryName,
          }));
        }
      }
      
      if (parsed.blockNumber) {
        setErrorEditFormData((prev: any) => ({
          ...prev,
          blockNumber: parsed.blockNumber,
        }));
      }
      
      showSuccess('Категория успешно распознана');
    } catch (error: any) {
      console.error('Error parsing category:', error);
      showError(error.response?.data?.error || 'Ошибка распознавания категории');
    }
  };

  const handleSaveErrorEdit = async () => {
    if (!editingError || !selectedEventForErrors) return;
    try {
      const rowData = editingError.rowData;
      
      // Находим ID для дисциплины, номинации, возраста, категории
      const discipline = errorEditDisciplines.find((d: any) => String(d.id) === errorEditFormData.disciplineId);
      const nomination = errorEditNominations.find((n: any) => String(n.id) === errorEditFormData.nominationId);
      const age = errorEditAges.find((a: any) => String(a.id) === errorEditFormData.ageId);
      const category = errorEditCategories.find((c: any) => String(c.id) === errorEditFormData.categoryId);
      
      const updatedRowData = {
        ...rowData,
        categoryString: errorEditFormData.categoryString || '',
        collective: errorEditFormData.collective || '',
        danceName: errorEditFormData.danceName || '',
        participantsCount: parseInt(String(errorEditFormData.participantsCount)) || 0,
        federationParticipantsCount: parseInt(String(errorEditFormData.federationParticipantsCount)) || 0,
        leaders: errorEditFormData.leaders || '',
        trainers: errorEditFormData.trainers || '',
        school: errorEditFormData.school || '',
        contacts: errorEditFormData.contacts || '',
        city: errorEditFormData.city || '',
        duration: errorEditFormData.duration || '',
        videoUrl: errorEditFormData.videoUrl || '',
        diplomasList: errorEditFormData.diplomasList || '',
        medalsCount: parseInt(String(errorEditFormData.medalsCount)) || 0,
        parsed: {
          ...rowData.parsed,
          blockNumber: errorEditFormData.blockNumber ? parseInt(String(errorEditFormData.blockNumber)) : undefined,
          disciplineId: discipline ? discipline.id : undefined,
          disciplineName: discipline ? discipline.name : errorEditFormData.disciplineName || '',
          nominationId: nomination ? nomination.id : undefined,
          nominationName: nomination ? nomination.name : errorEditFormData.nominationName || '',
          ageId: age ? age.id : undefined,
          ageName: age ? age.name : errorEditFormData.ageName || '',
          categoryId: category ? category.id : undefined,
          categoryName: category ? category.name : errorEditFormData.categoryName || '',
        },
      };
      
      await api.put(`/api/events/${selectedEventForErrors}/import-errors/${editingError.id}`, updatedRowData);
      showSuccess('Запись обновлена');
      setEditingError(null);
      fetchImportErrors(selectedEventForErrors);
    } catch (error: any) {
      console.error('Error updating import error:', error);
      showError(error.response?.data?.error || 'Ошибка обновления записи');
    }
  };

  const handleDeleteEventClick = (eventId: number) => {
    setEventToDelete(eventId);
    setDeleteEventConfirmOpen(true);
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    try {
      await api.delete(`/api/events/${eventToDelete}`);
      showSuccess('Мероприятие удалено');
      setDeleteEventConfirmOpen(false);
      setEventToDelete(null);
      fetchEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      showError(error.response?.data?.error || 'Ошибка удаления мероприятия');
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const fetchReferences = async () => {
    setReferenceLoading(true);
    try {
      const [disciplinesRes, nominationsRes, agesRes, categoriesRes] = await Promise.all([
        api.get('/api/reference/disciplines'),
        api.get('/api/reference/nominations'),
        api.get('/api/reference/ages'),
        api.get('/api/reference/categories'),
      ]);
      setDisciplines(disciplinesRes.data);
      setNominations(nominationsRes.data);
      setAges(agesRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching references:', error);
    } finally {
      setReferenceLoading(false);
    }
  };

  const handleSaveDiscipline = async () => {
    if (!disciplineFormData.name.trim()) {
      showError('Название дисциплины обязательно');
      return;
    }

    try {
      if (editingDiscipline) {
        await api.put(`/api/reference/disciplines/${editingDiscipline.id}`, {
          name: disciplineFormData.name,
          abbreviations: disciplineFormData.abbreviations,
          variants: disciplineFormData.variants,
        });
        showSuccess('Дисциплина обновлена');
      } else {
        await api.post('/api/reference/disciplines', {
          name: disciplineFormData.name,
          abbreviations: disciplineFormData.abbreviations,
          variants: disciplineFormData.variants,
        });
        showSuccess('Дисциплина добавлена');
      }
      setEditingDiscipline(null);
      setDisciplineFormData({ name: '', abbreviations: [], variants: [] });
      fetchReferences();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Ошибка сохранения дисциплины');
    }
  };

  const handleSaveNomination = async () => {
    if (!nominationFormData.name.trim()) {
      showError('Название номинации обязательно');
      return;
    }

    try {
      if (editingNomination && editingNomination.id) {
        await api.put(`/api/reference/nominations/${editingNomination.id}`, {
          name: nominationFormData.name,
        });
        showSuccess('Номинация обновлена');
      } else {
        await api.post('/api/reference/nominations', {
          name: nominationFormData.name,
        });
        showSuccess('Номинация добавлена');
      }
      setEditingNomination(null);
      setNominationFormData({ name: '' });
      fetchReferences();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Ошибка сохранения номинации');
    }
  };

  const handleSaveAge = async () => {
    if (!ageFormData.name.trim()) {
      showError('Название возраста обязательно');
      return;
    }

    try {
      if (editingAge) {
        await api.put(`/api/reference/ages/${editingAge.id}`, {
          name: ageFormData.name,
        });
        showSuccess('Возраст обновлен');
      } else {
        await api.post('/api/reference/ages', {
          name: ageFormData.name,
        });
        showSuccess('Возраст добавлен');
      }
      setEditingAge(null);
      setAgeFormData({ name: '' });
      fetchReferences();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Ошибка сохранения возраста');
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryFormData.name.trim()) {
      showError('Название категории обязательно');
      return;
    }

    try {
      if (editingCategory) {
        await api.put(`/api/reference/categories/${editingCategory.id}`, {
          name: categoryFormData.name,
        });
        showSuccess('Категория обновлена');
      } else {
        await api.post('/api/reference/categories', {
          name: categoryFormData.name,
        });
        showSuccess('Категория добавлена');
      }
      setEditingCategory(null);
      setCategoryFormData({ name: '' });
      fetchReferences();
    } catch (error: any) {
      showError(error.response?.data?.error || 'Ошибка сохранения категории');
    }
  };

  const renderSettingField = (setting: SettingItem) => {
    const currentValue = systemSettings[setting.key] !== undefined 
      ? systemSettings[setting.key] 
      : setting.defaultValue;

    switch (setting.type) {
      case 'boolean':
        return (
          <FormControlLabel
            control={
              <Checkbox
                checked={currentValue === true || currentValue === 'true'}
                onChange={(e) => {
                  handleSaveSetting(setting.key, e.target.checked);
                }}
              />
            }
            label={setting.label}
          />
        );

      case 'select':
        return (
          <FormControl fullWidth>
            <InputLabel>{setting.label}</InputLabel>
            <Select
              value={String(currentValue)}
              label={setting.label}
              onChange={(e) => {
                const value = setting.options?.find(opt => opt.value === e.target.value)?.value || e.target.value;
                handleSaveSetting(setting.key, value);
              }}
            >
              {setting.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );

      case 'textarea':
        return (
          <TextField
            fullWidth
            label={setting.label}
            multiline
            rows={4}
            value={currentValue || ''}
            onChange={(e) => {
              setSystemSettings({
                ...systemSettings,
                [setting.key]: e.target.value,
              });
            }}
            onBlur={() => {
              handleSaveSetting(setting.key, systemSettings[setting.key]);
            }}
            helperText={setting.description}
          />
        );

      case 'number':
        return (
          <TextField
            fullWidth
            label={setting.label}
            type="number"
            value={currentValue || setting.defaultValue || ''}
            onChange={(e) => {
              setSystemSettings({
                ...systemSettings,
                [setting.key]: e.target.value,
              });
            }}
            onBlur={() => {
              const numValue = parseFloat(systemSettings[setting.key] || setting.defaultValue);
              if (!isNaN(numValue)) {
                handleSaveSetting(setting.key, numValue);
              }
            }}
            inputProps={{
              min: setting.min,
              max: setting.max,
              step: setting.step,
            }}
            helperText={setting.description}
          />
        );

      default:
        return (
          <TextField
            fullWidth
            label={setting.label}
            value={currentValue || ''}
            onChange={(e) => {
              setSystemSettings({
                ...systemSettings,
                [setting.key]: e.target.value,
              });
            }}
            onBlur={() => {
              handleSaveSetting(setting.key, systemSettings[setting.key]);
            }}
            helperText={setting.description}
          />
        );
    }
  };

  return (
    <Box>
      <Paper>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Пользователи" />
          <Tab label="Мероприятия" />
          <Tab label="Ошибки импорта" />
          <Tab label="Справочники" />
          <Tab label="Системные настройки" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Пользователи</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setUserDialogOpen(true)}>
              Добавить пользователя
            </Button>
          </Box>
          {loading ? (
            <CircularProgress />
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Имя</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Роль</TableCell>
                    <TableCell>Город</TableCell>
                    <TableCell>Телефон</TableCell>
                    <TableCell>Дата создания</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role}</TableCell>
                      <TableCell>{user.city || '-'}</TableCell>
                      <TableCell>{user.phone || '-'}</TableCell>
                      <TableCell>{user.createdAt ? formatDate(user.createdAt) : '-'}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEditUser(user)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteUserClick(user.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Мероприятия</Typography>
            <Box>
              <Button variant="outlined" onClick={() => setExcelImportOpen(true)} sx={{ mr: 1 }}>
                Импорт Excel
              </Button>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEventDialogOpen(true)}>
                Добавить мероприятие
              </Button>
            </Box>
          </Box>
          {loading ? (
            <CircularProgress />
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Название</TableCell>
                    <TableCell>Дата начала</TableCell>
                    <TableCell>Дата окончания</TableCell>
                    <TableCell>Статус</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.name}</TableCell>
                      <TableCell>{event.startDate ? formatDate(event.startDate) : '-'}</TableCell>
                      <TableCell>{event.endDate ? formatDate(event.endDate) : '-'}</TableCell>
                      <TableCell>{event.status}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEditEvent(event)} title="Редактировать">
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => openPricesDialog(event)}
                          title="Цены по номинациям"
                        >
                          <SaveIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDuplicateEvent(event.id)}
                          title="Дублировать"
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteEventClick(event.id)}
                          title="Удалить"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ mb: 3 }}>
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Мероприятие</InputLabel>
              <Select
                value={selectedEventForErrors}
                label="Мероприятие"
                onChange={(e) => {
                  const eventId = e.target.value as number;
                  setSelectedEventForErrors(eventId);
                  if (eventId) {
                    fetchImportErrors(eventId);
                  }
                  // Не очищаем ошибки при сбросе выбора, чтобы они оставались видимыми
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

          {!selectedEventForErrors ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Выберите мероприятие для просмотра записей с ошибками импорта
              </Typography>
            </Box>
          ) : importErrorsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Строка</TableCell>
                    <TableCell>Коллектив</TableCell>
                    <TableCell>Название</TableCell>
                    <TableCell>Дисциплина</TableCell>
                    <TableCell>Номинация</TableCell>
                    <TableCell>Возраст</TableCell>
                    <TableCell>Категория</TableCell>
                    <TableCell>Ошибки</TableCell>
                    <TableCell>Действия</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {importErrors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center">
                        Нет записей с ошибками импорта для выбранного мероприятия
                      </TableCell>
                    </TableRow>
                  ) : (
                    importErrors.map((error) => (
                      <TableRow key={error.id}>
                        <TableCell>{error.rowNumber}</TableCell>
                        <TableCell>{error.rowData?.collective || '-'}</TableCell>
                        <TableCell>{error.rowData?.danceName || '-'}</TableCell>
                        <TableCell>{error.rowData?.parsed?.disciplineName || '-'}</TableCell>
                        <TableCell>{error.rowData?.parsed?.nominationName || '-'}</TableCell>
                        <TableCell>{error.rowData?.parsed?.ageName || '-'}</TableCell>
                        <TableCell>{error.rowData?.parsed?.categoryName || '-'}</TableCell>
                        <TableCell>
                          <Box>
                            {(error.errors || []).map((err: string, idx: number) => (
                              <Typography key={idx} variant="caption" color="error" display="block">
                                {err}
                              </Typography>
                            ))}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => handleEditImportError(error)} title="Редактировать">
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleImportError(error.id)} color="primary" title="Импортировать">
                            <CheckCircleIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => handleDeleteImportError(error.id)} color="error" title="Удалить">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Диалог редактирования ошибки импорта */}
          <Dialog open={!!editingError} onClose={() => setEditingError(null)} maxWidth="lg" fullWidth>
            <DialogTitle>Редактирование записи с ошибкой</DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {/* Строка категории с автоматическим распознаванием */}
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <TextField
                      fullWidth
                      label="Строка категории (например: '1. Jazz Соло Бэби Beginners')"
                      value={errorEditFormData.categoryString || ''}
                      onChange={(e) => setErrorEditFormData({ ...errorEditFormData, categoryString: e.target.value })}
                      helperText="Введите строку категории и нажмите 'Распознать' для автоматического заполнения полей"
                      multiline
                      rows={2}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => handleParseCategoryString(errorEditFormData.categoryString || '')}
                      disabled={!errorEditFormData.categoryString}
                      sx={{ mt: 1, whiteSpace: 'nowrap' }}
                    >
                      Распознать
                    </Button>
                  </Box>
                </Grid>
                
                <Grid item xs={12}>
                  <Divider />
                </Grid>

                {/* Основные поля */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    required
                    label="Коллектив"
                    value={errorEditFormData.collective || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, collective: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Название танца"
                    value={errorEditFormData.danceName || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, danceName: e.target.value })}
                  />
                </Grid>
                
                {/* Дисциплина, номинация, возраст, категория */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Дисциплина</InputLabel>
                    <Select
                      value={errorEditFormData.disciplineId || ''}
                      label="Дисциплина"
                      onChange={(e) => {
                        const discipline = errorEditDisciplines.find((d: any) => String(d.id) === e.target.value);
                        setErrorEditFormData({
                          ...errorEditFormData,
                          disciplineId: e.target.value,
                          disciplineName: discipline ? discipline.name : '',
                        });
                      }}
                      disabled={errorEditDisciplines.length === 0}
                    >
                      {errorEditDisciplines.length === 0 ? (
                        <MenuItem disabled>Загрузка...</MenuItem>
                      ) : (
                        errorEditDisciplines.map((discipline: any) => (
                          <MenuItem key={discipline.id} value={String(discipline.id)}>
                            {discipline.name}
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Номинация</InputLabel>
                    <Select
                      value={errorEditFormData.nominationId || ''}
                      label="Номинация"
                      onChange={(e) => {
                        const nomination = errorEditNominations.find((n: any) => String(n.id) === e.target.value);
                        setErrorEditFormData({
                          ...errorEditFormData,
                          nominationId: e.target.value,
                          nominationName: nomination ? nomination.name : '',
                        });
                      }}
                      disabled={errorEditNominations.length === 0}
                    >
                      {errorEditNominations.length === 0 ? (
                        <MenuItem disabled>Загрузка...</MenuItem>
                      ) : (
                        errorEditNominations.map((nomination: any) => (
                          <MenuItem key={nomination.id} value={String(nomination.id)}>
                            {nomination.name}
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Возраст</InputLabel>
                    <Select
                      value={errorEditFormData.ageId || ''}
                      label="Возраст"
                      onChange={(e) => {
                        const age = errorEditAges.find((a: any) => String(a.id) === e.target.value);
                        setErrorEditFormData({
                          ...errorEditFormData,
                          ageId: e.target.value,
                          ageName: age ? age.name : '',
                        });
                      }}
                      disabled={errorEditAges.length === 0}
                    >
                      {errorEditAges.length === 0 ? (
                        <MenuItem disabled>Загрузка...</MenuItem>
                      ) : (
                        errorEditAges.map((age: any) => (
                          <MenuItem key={age.id} value={String(age.id)}>
                            {age.name}
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Категория</InputLabel>
                    <Select
                      value={errorEditFormData.categoryId || ''}
                      label="Категория"
                      onChange={(e) => {
                        const category = errorEditCategories.find((c: any) => String(c.id) === e.target.value);
                        setErrorEditFormData({
                          ...errorEditFormData,
                          categoryId: e.target.value,
                          categoryName: category ? category.name : '',
                        });
                      }}
                      disabled={errorEditCategories.length === 0}
                    >
                      <MenuItem value="">
                        <em>Не выбрано</em>
                      </MenuItem>
                      {errorEditCategories.length === 0 ? (
                        <MenuItem disabled>Загрузка...</MenuItem>
                      ) : (
                        errorEditCategories.map((category: any) => (
                          <MenuItem key={category.id} value={String(category.id)}>
                            {category.name}
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                </Grid>
                
                {/* Участники */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Количество участников"
                    type="number"
                    value={errorEditFormData.participantsCount || 0}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, participantsCount: parseInt(e.target.value) || 0 })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Участников федерации"
                    type="number"
                    value={errorEditFormData.federationParticipantsCount || 0}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, federationParticipantsCount: parseInt(e.target.value) || 0 })}
                  />
                </Grid>
                
                {/* Блок */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Номер блока"
                    type="number"
                    value={errorEditFormData.blockNumber || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, blockNumber: e.target.value })}
                  />
                </Grid>
                
                {/* Руководители и тренеры */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Руководители"
                    value={errorEditFormData.leaders || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, leaders: e.target.value })}
                    helperText="Можно указать несколько через запятую"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Тренеры"
                    value={errorEditFormData.trainers || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, trainers: e.target.value })}
                    helperText="Можно указать несколько через запятую"
                  />
                </Grid>
                
                {/* Школа, контакты, город */}
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Школа"
                    value={errorEditFormData.school || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, school: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Контакты"
                    value={errorEditFormData.contacts || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, contacts: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    label="Город"
                    value={errorEditFormData.city || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, city: e.target.value })}
                  />
                </Grid>
                
                {/* Длительность и видео */}
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Длительность (HH:MM:SS или MM:SS)"
                    value={errorEditFormData.duration || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, duration: e.target.value })}
                    placeholder="03:45 или 03:45:00"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Видео URL"
                    value={errorEditFormData.videoUrl || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, videoUrl: e.target.value })}
                  />
                </Grid>
                
                {/* Дипломы и медали */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="ФИО на дипломы (каждое на новой строке)"
                    multiline
                    rows={4}
                    value={errorEditFormData.diplomasList || ''}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, diplomasList: e.target.value })}
                    helperText="Введите ФИО участников, каждое с новой строки"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Количество медалей"
                    type="number"
                    value={errorEditFormData.medalsCount || 0}
                    onChange={(e) => setErrorEditFormData({ ...errorEditFormData, medalsCount: parseInt(e.target.value) || 0 })}
                  />
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditingError(null)}>Отмена</Button>
              <Button variant="contained" onClick={handleSaveErrorEdit}>
                Сохранить
              </Button>
            </DialogActions>
          </Dialog>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Управление справочниками
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Управляйте справочниками для корректного распознавания при импорте из Excel
            </Typography>
          </Box>

          {referenceLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Дисциплины</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setDisciplineFormData({ name: '', abbreviations: [], variants: [] });
                        setEditingDiscipline(null);
                        setNewAbbreviation('');
                        setNewVariant('');
                        setShowDisciplineDialog(true);
                      }}
                    >
                      Добавить дисциплину
                    </Button>
                  </Box>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Название</TableCell>
                          <TableCell>Аббревиатуры</TableCell>
                          <TableCell>Варианты написания</TableCell>
                          <TableCell>Действия</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {disciplines.map((discipline) => {
                          const abbrs = discipline.abbreviations ? JSON.parse(discipline.abbreviations) : [];
                          const vars = discipline.variants ? JSON.parse(discipline.variants) : [];
                          return (
                            <TableRow key={discipline.id}>
                              <TableCell>{discipline.name}</TableCell>
                              <TableCell>
                                {Array.isArray(abbrs) && abbrs.length > 0 ? (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {abbrs.map((abbr: string, idx: number) => (
                                      <Chip key={idx} label={abbr} size="small" />
                                    ))}
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">Нет</Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                {Array.isArray(vars) && vars.length > 0 ? (
                                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                    {vars.map((variant: string, idx: number) => (
                                      <Chip key={idx} label={variant} size="small" color="secondary" />
                                    ))}
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="text.secondary">Нет</Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setEditingDiscipline(discipline);
                                    setDisciplineFormData({
                                      name: discipline.name,
                                      abbreviations: abbrs,
                                      variants: vars,
                                    });
                                    setNewAbbreviation('');
                                    setNewVariant('');
                                    setShowDisciplineDialog(true);
                                  }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={async () => {
                                    if (window.confirm(`Удалить дисциплину "${discipline.name}"?`)) {
                                      try {
                                        await api.delete(`/api/reference/disciplines/${discipline.id}`);
                                        showSuccess('Дисциплина удалена');
                                        fetchReferences();
                                      } catch (error: any) {
                                        showError(error.response?.data?.error || 'Ошибка удаления дисциплины');
                                      }
                                    }
                                  }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Номинации</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setNominationFormData({ name: '' });
                        setEditingNomination(null);
                      }}
                    >
                      Добавить номинацию
                    </Button>
                  </Box>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Название</TableCell>
                          <TableCell>Действия</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {nominations.map((nomination) => (
                          <TableRow key={nomination.id}>
                            <TableCell>{nomination.name}</TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingNomination(nomination);
                                  setNominationFormData({ name: nomination.name });
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={async () => {
                                  if (window.confirm(`Удалить номинацию "${nomination.name}"?`)) {
                                    try {
                                      await api.delete(`/api/reference/nominations/${nomination.id}`);
                                      showSuccess('Номинация удалена');
                                      fetchReferences();
                                    } catch (error: any) {
                                      showError(error.response?.data?.error || 'Ошибка удаления номинации');
                                    }
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Возрасты</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setAgeFormData({ name: '' });
                        setEditingAge({ id: 0, name: '' } as any);
                      }}
                    >
                      Добавить возраст
                    </Button>
                  </Box>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Название</TableCell>
                          <TableCell>Действия</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {ages.map((age) => (
                          <TableRow key={age.id}>
                            <TableCell>{age.name}</TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingAge(age);
                                  setAgeFormData({ name: age.name });
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={async () => {
                                  if (window.confirm(`Удалить возраст "${age.name}"?`)) {
                                    try {
                                      await api.delete(`/api/reference/ages/${age.id}`);
                                      showSuccess('Возраст удален');
                                      fetchReferences();
                                    } catch (error: any) {
                                      showError(error.response?.data?.error || 'Ошибка удаления возраста');
                                    }
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Категории</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setCategoryFormData({ name: '' });
                        setEditingCategory({ id: 0, name: '' } as any);
                      }}
                    >
                      Добавить категорию
                    </Button>
                  </Box>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Название</TableCell>
                          <TableCell>Действия</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {categories.map((category) => (
                          <TableRow key={category.id}>
                            <TableCell>{category.name}</TableCell>
                            <TableCell>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setEditingCategory(category);
                                  setCategoryFormData({ name: category.name });
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={async () => {
                                  if (window.confirm(`Удалить категорию "${category.name}"?`)) {
                                    try {
                                      await api.delete(`/api/reference/categories/${category.id}`);
                                      showSuccess('Категория удалена');
                                      fetchReferences();
                                    } catch (error: any) {
                                      showError(error.response?.data?.error || 'Ошибка удаления категории');
                                    }
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Системные настройки
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Настройте параметры работы системы. Изменения сохраняются автоматически при потере фокуса поля.
            </Typography>
          </Box>

          {settingsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {SETTING_CATEGORIES.map((category) => (
                <Grid item xs={12} key={category.id}>
                  <Accordion
                    expanded={expandedCategories.has(category.id)}
                    onChange={() => toggleCategory(category.id)}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Box>
                        <Typography variant="h6">{category.name}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {category.description}
                        </Typography>
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        {category.settings.map((setting) => (
                          <Grid item xs={12} md={6} key={setting.key}>
                            <Card variant="outlined">
                              <CardContent>
                                {renderSettingField(setting)}
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>
              ))}
            </Grid>
          )}
        </TabPanel>
      </Paper>

      {/* Диалог редактирования дисциплины */}
      <Dialog open={showDisciplineDialog} onClose={() => {
        setEditingDiscipline(null);
        setDisciplineFormData({ name: '', abbreviations: [], variants: [] });
        setNewAbbreviation('');
        setNewVariant('');
        setShowDisciplineDialog(false);
      }} maxWidth="md" fullWidth>
        <DialogTitle>{editingDiscipline ? 'Редактирование дисциплины' : 'Добавление дисциплины'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                required
                label="Название дисциплины"
                value={disciplineFormData.name}
                onChange={(e) => setDisciplineFormData({ ...disciplineFormData, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Аббревиатуры (например: СТК, СЭТ, ЭТ)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {disciplineFormData.abbreviations.map((abbr, idx) => (
                  <Chip
                    key={idx}
                    label={abbr}
                    onDelete={() => {
                      const newAbbrs = [...disciplineFormData.abbreviations];
                      newAbbrs.splice(idx, 1);
                      setDisciplineFormData({ ...disciplineFormData, abbreviations: newAbbrs });
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="Новая аббревиатура"
                  value={newAbbreviation}
                  onChange={(e) => setNewAbbreviation(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newAbbreviation.trim()) {
                      setDisciplineFormData({
                        ...disciplineFormData,
                        abbreviations: [...disciplineFormData.abbreviations, newAbbreviation.trim()],
                      });
                      setNewAbbreviation('');
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    if (newAbbreviation.trim()) {
                      setDisciplineFormData({
                        ...disciplineFormData,
                        abbreviations: [...disciplineFormData.abbreviations, newAbbreviation.trim()],
                      });
                      setNewAbbreviation('');
                    }
                  }}
                >
                  Добавить
                </Button>
              </Box>
            </Grid>
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Варианты написания (для распознавания опечаток)
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {disciplineFormData.variants.map((variant, idx) => (
                  <Chip
                    key={idx}
                    label={variant}
                    color="secondary"
                    onDelete={() => {
                      const newVariants = [...disciplineFormData.variants];
                      newVariants.splice(idx, 1);
                      setDisciplineFormData({ ...disciplineFormData, variants: newVariants });
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  placeholder="Новый вариант написания"
                  value={newVariant}
                  onChange={(e) => setNewVariant(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && newVariant.trim()) {
                      setDisciplineFormData({
                        ...disciplineFormData,
                        variants: [...disciplineFormData.variants, newVariant.trim()],
                      });
                      setNewVariant('');
                    }
                  }}
                />
                <Button
                  variant="outlined"
                  onClick={() => {
                    if (newVariant.trim()) {
                      setDisciplineFormData({
                        ...disciplineFormData,
                        variants: [...disciplineFormData.variants, newVariant.trim()],
                      });
                      setNewVariant('');
                    }
                  }}
                >
                  Добавить
                </Button>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditingDiscipline(null);
            setDisciplineFormData({ name: '', abbreviations: [], variants: [] });
            setNewAbbreviation('');
            setNewVariant('');
            setShowDisciplineDialog(false);
          }}>
            Отмена
          </Button>
          <Button variant="contained" onClick={() => {
            handleSaveDiscipline();
            setShowDisciplineDialog(false);
          }}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования номинации */}
      <Dialog open={!!editingNomination} onClose={() => {
        setEditingNomination(null);
        setNominationFormData({ name: '' });
      }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingNomination && editingNomination.id ? 'Редактирование номинации' : 'Добавление номинации'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            required
            label="Название номинации"
            value={nominationFormData.name}
            onChange={(e) => setNominationFormData({ name: e.target.value })}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditingNomination(null);
            setNominationFormData({ name: '' });
          }}>
            Отмена
          </Button>
          <Button variant="contained" onClick={handleSaveNomination}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования возраста */}
      <Dialog open={!!editingAge} onClose={() => {
        setEditingAge(null);
        setAgeFormData({ name: '' });
      }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingAge && editingAge.id ? 'Редактирование возраста' : 'Добавление возраста'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            required
            label="Название возраста"
            value={ageFormData.name}
            onChange={(e) => setAgeFormData({ name: e.target.value })}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditingAge(null);
            setAgeFormData({ name: '' });
          }}>
            Отмена
          </Button>
          <Button variant="contained" onClick={handleSaveAge}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования категории */}
      <Dialog open={!!editingCategory} onClose={() => {
        setEditingCategory(null);
        setCategoryFormData({ name: '' });
      }} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory && editingCategory.id ? 'Редактирование категории' : 'Добавление категории'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            required
            label="Название категории"
            value={categoryFormData.name}
            onChange={(e) => setCategoryFormData({ name: e.target.value })}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditingCategory(null);
            setCategoryFormData({ name: '' });
          }}>
            Отмена
          </Button>
          <Button variant="contained" onClick={handleSaveCategory}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedUser ? 'Редактирование пользователя' : 'Создание пользователя'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Имя *"
                value={userFormData.name}
                onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email *"
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label={selectedUser ? 'Новый пароль (оставьте пустым чтобы не менять)' : 'Пароль *'}
                type="password"
                value={userFormData.password}
                onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                required={!selectedUser}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Роль *</InputLabel>
                <Select
                  value={userFormData.role}
                  label="Роль *"
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value as User['role'] })}
                >
                  <MenuItem value="ADMIN">ADMIN</MenuItem>
                  <MenuItem value="REGISTRATOR">REGISTRATOR</MenuItem>
                  <MenuItem value="ACCOUNTANT">ACCOUNTANT</MenuItem>
                  <MenuItem value="STATISTICIAN">STATISTICIAN</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Город"
                value={userFormData.city}
                onChange={(e) => setUserFormData({ ...userFormData, city: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Телефон"
                value={userFormData.phone}
                onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSaveUser}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={eventDialogOpen} onClose={() => setEventDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedEvent ? 'Редактирование мероприятия' : 'Создание мероприятия'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название *"
                value={eventFormData.name}
                onChange={(e) => setEventFormData({ ...eventFormData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Дата начала *"
                type="date"
                value={eventFormData.startDate}
                onChange={(e) => setEventFormData({ ...eventFormData, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Дата окончания *"
                type="date"
                value={eventFormData.endDate}
                onChange={(e) => setEventFormData({ ...eventFormData, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Статус *</InputLabel>
                <Select
                  value={eventFormData.status}
                  label="Статус *"
                  onChange={(e) => setEventFormData({ ...eventFormData, status: e.target.value as any })}
                >
                  <MenuItem value="DRAFT">Черновик</MenuItem>
                  <MenuItem value="ACTIVE">Активно</MenuItem>
                  <MenuItem value="ARCHIVED">Архив</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Максимальная длительность (секунды)"
                type="number"
                value={eventFormData.durationMax}
                onChange={(e) => setEventFormData({ ...eventFormData, durationMax: e.target.value })}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={eventFormData.isOnline}
                    onChange={(e) => setEventFormData({ ...eventFormData, isOnline: e.target.checked })}
                  />
                }
                label="Онлайн мероприятие"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={eventFormData.paymentEnable}
                    onChange={(e) => setEventFormData({ ...eventFormData, paymentEnable: e.target.checked })}
                  />
                }
                label="Включить оплату"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={eventFormData.categoryEnable}
                    onChange={(e) => setEventFormData({ ...eventFormData, categoryEnable: e.target.checked })}
                  />
                }
                label="Включить категории"
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={eventFormData.songEnable}
                    onChange={(e) => setEventFormData({ ...eventFormData, songEnable: e.target.checked })}
                  />
                }
                label="Включить песню"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Цена за диплом (руб)"
                type="number"
                value={eventFormData.pricePerDiploma}
                onChange={(e) => setEventFormData({ ...eventFormData, pricePerDiploma: e.target.value })}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Цена за медаль (руб)"
                type="number"
                value={eventFormData.pricePerMedal}
                onChange={(e) => setEventFormData({ ...eventFormData, pricePerMedal: e.target.value })}
                inputProps={{ min: 0 }}
              />
            </Grid>
            <Grid item xs={12}>
              <DiscountTiersEditor
                value={eventFormData.discountTiers}
                onChange={(value) => setEventFormData({ ...eventFormData, discountTiers: value })}
                helperText="Настройте уровни откатов в зависимости от общей суммы выступлений"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={handleSaveEvent}>
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={deleteUserConfirmOpen}
        title="Удаление пользователя"
        message="Вы уверены, что хотите удалить этого пользователя?"
        onConfirm={handleDeleteUser}
        onCancel={() => setDeleteUserConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteEventConfirmOpen}
        title="Удаление мероприятия"
        message="Вы уверены, что хотите удалить это мероприятие? Все связанные регистрации также будут удалены."
        onConfirm={handleDeleteEvent}
        onCancel={() => setDeleteEventConfirmOpen(false)}
      />

      <ExcelImportDialog
        open={excelImportOpen}
        onClose={() => setExcelImportOpen(false)}
        events={events}
        onImportComplete={() => {
          fetchEvents();
          setExcelImportOpen(false);
          // После импорта обновляем список ошибок, если открыта вкладка ошибок импорта
          if (tabValue === 2 && selectedEventForErrors) {
            fetchImportErrors(selectedEventForErrors);
          }
        }}
      />

      {/* Диалог настройки цен по номинациям для мероприятия */}
      <Dialog open={priceDialogOpen} onClose={() => setPriceDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Цены по номинациям{priceEvent ? ` — ${priceEvent.name}` : ''}
        </DialogTitle>
        <DialogContent>
          {priceLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Укажите стоимость выступления для каждой номинации отдельно для обычных участников и членов федерации.
                Цены указываются в рублях за одного участника.
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Номинация</TableCell>
                      <TableCell>Цена за участника</TableCell>
                      <TableCell>Цена за участника федерации</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {priceRows.map((row, index) => (
                      <TableRow key={row.nominationId}>
                        <TableCell>{row.nominationName}</TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={row.pricePerParticipant}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPriceRows((prev) => {
                                const copy = [...prev];
                                copy[index] = { ...copy[index], pricePerParticipant: value };
                                return copy;
                              });
                            }}
                            inputProps={{ min: 0 }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="number"
                            size="small"
                            value={row.pricePerFederationParticipant}
                            onChange={(e) => {
                              const value = e.target.value;
                              setPriceRows((prev) => {
                                const copy = [...prev];
                                copy[index] = { ...copy[index], pricePerFederationParticipant: value };
                                return copy;
                              });
                            }}
                            inputProps={{ min: 0 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="info" sx={{ mt: 2 }}>
                Если цена для члена федерации не указана, будет использована обычная цена для этой номинации.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriceDialogOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={handleSavePrices}
            disabled={priceSaving || priceLoading || !priceEvent}
            startIcon={priceSaving ? <CircularProgress size={18} /> : <SaveIcon />}
          >
            Сохранить цены
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
