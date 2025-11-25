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
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
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

  useEffect(() => {
    if (tabValue === 0) {
      fetchUsers();
    } else if (tabValue === 1) {
      fetchEvents();
    } else if (tabValue === 2) {
      fetchSettings();
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
                        <IconButton size="small" onClick={() => handleEditEvent(event)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDuplicateEvent(event.id)}
                          title="Дублировать"
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDeleteEventClick(event.id)}>
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
        }}
      />
    </Box>
  );
};
