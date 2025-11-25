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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
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
  const [deleteUserConfirmOpen, setDeleteUserConfirmOpen] = useState(false);
  const [deleteEventConfirmOpen, setDeleteEventConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [eventToDelete, setEventToDelete] = useState<number | null>(null);
  const [excelImportOpen, setExcelImportOpen] = useState(false);

  useEffect(() => {
    if (tabValue === 0) {
      fetchUsers();
    } else if (tabValue === 1) {
      fetchEvents();
    } else if (tabValue === 2) {
      fetchSystemSettings();
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

  const handleCreateUser = () => {
    setSelectedUser(null);
    setUserFormData({
      name: '',
      email: '',
      password: '',
      role: 'REGISTRATOR',
      city: '',
      phone: '',
    });
    setUserDialogOpen(true);
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

  const handleSaveUser = async () => {
    try {
      if (selectedUser) {
        await api.put(`/api/admin/users/${selectedUser.id}`, userFormData);
        showSuccess('Пользователь успешно обновлен');
      } else {
        await api.post('/api/admin/users', userFormData);
        showSuccess('Пользователь успешно создан');
      }
      setUserDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      console.error('Error saving user:', error);
      showError(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleDeleteUserClick = (id: number) => {
    setUserToDelete(id);
    setDeleteUserConfirmOpen(true);
  };

  const handleDeleteUserConfirm = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/api/admin/users/${userToDelete}`);
      fetchUsers();
      showSuccess('Пользователь успешно удален');
      setDeleteUserConfirmOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const handleCreateEvent = () => {
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
      discountTiers: JSON.stringify([
        { min: 0, max: 9999, discountPercent: 0 },
        { min: 10000, max: 49999, discountPercent: 10 },
        { min: 50000, max: 99999, discountPercent: 15 },
        { min: 100000, max: 199999, discountPercent: 20 },
        { min: 200000, max: 499999, discountPercent: 25 },
        { min: 500000, max: 999999999, discountPercent: 30 },
      ], null, 2),
    });
    setEventDialogOpen(true);
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
      durationMax: String(event.durationMax || ''),
      pricePerDiploma: String(event.pricePerDiploma || ''),
      pricePerMedal: String(event.pricePerMedal || ''),
      discountTiers: event.discountTiers || JSON.stringify([], null, 2),
    });
    setEventDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    try {
      const payload: any = {
        name: eventFormData.name,
        startDate: eventFormData.startDate,
        endDate: eventFormData.endDate,
        status: eventFormData.status,
        isOnline: eventFormData.isOnline,
        paymentEnable: eventFormData.paymentEnable,
        categoryEnable: eventFormData.categoryEnable,
        songEnable: eventFormData.songEnable,
        durationMax: eventFormData.durationMax ? parseInt(eventFormData.durationMax) : undefined,
        pricePerDiploma: eventFormData.pricePerDiploma ? parseFloat(eventFormData.pricePerDiploma) : undefined,
        pricePerMedal: eventFormData.pricePerMedal ? parseFloat(eventFormData.pricePerMedal) : undefined,
        discountTiers: eventFormData.discountTiers,
      };

      if (selectedEvent) {
        await api.put(`/api/events/${selectedEvent.id}`, payload);
        showSuccess('Мероприятие успешно обновлено');
      } else {
        await api.post('/api/events', payload);
        showSuccess('Мероприятие успешно создано');
      }
      setEventDialogOpen(false);
      fetchEvents();
    } catch (error: any) {
      console.error('Error saving event:', error);
      showError(error.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const handleDuplicateEvent = async (eventId: number) => {
    try {
      await api.post(`/api/events/${eventId}/duplicate`);
      fetchEvents();
      showSuccess('Мероприятие успешно скопировано');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Ошибка копирования');
    }
  };

  const handleDeleteEventClick = (id: number) => {
    setEventToDelete(id);
    setDeleteEventConfirmOpen(true);
  };

  const handleDeleteEventConfirm = async () => {
    if (!eventToDelete) return;

    try {
      await api.delete(`/api/events/${eventToDelete}`);
      fetchEvents();
      showSuccess('Мероприятие успешно удалено');
      setDeleteEventConfirmOpen(false);
      setEventToDelete(null);
    } catch (error: any) {
      showError(error.response?.data?.error || 'Ошибка удаления');
    }
  };

  const fetchSystemSettings = async () => {
    try {
      const response = await api.get('/api/admin/settings');
      setSystemSettings(response.data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const handleSaveSetting = async (key: string, value: any) => {
    try {
      await api.put(`/api/admin/settings/${key}`, { value });
      fetchSystemSettings();
      showSuccess('Настройка успешно сохранена');
    } catch (error: any) {
      showError(error.response?.data?.error || 'Ошибка сохранения настройки');
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
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateUser}>
              Создать пользователя
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
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
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell>{u.city || '-'}</TableCell>
                      <TableCell>{u.phone || '-'}</TableCell>
                      <TableCell>{formatDate(u.createdAt || new Date().toISOString())}</TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => handleEditUser(u)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        {u.id !== user?.id && (
                          <IconButton size="small" onClick={() => handleDeleteUserClick(u.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 2 }}>
            <Button variant="outlined" onClick={() => setExcelImportOpen(true)}>
              Импорт из Excel
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreateEvent}>
              Создать мероприятие
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
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
                      <TableCell>{formatDate(event.startDate)}</TableCell>
                      <TableCell>{formatDate(event.endDate)}</TableCell>
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
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Время отмены оплаты дипломов (минуты)
                  </Typography>
                  <TextField
                    fullWidth
                    type="number"
                    value={systemSettings.diploma_cancel_timeout_minutes || ''}
                    onChange={(e) => {
                      setSystemSettings({
                        ...systemSettings,
                        diploma_cancel_timeout_minutes: e.target.value,
                      });
                    }}
                    onBlur={() => {
                      if (systemSettings.diploma_cancel_timeout_minutes !== undefined) {
                        handleSaveSetting('diploma_cancel_timeout_minutes', systemSettings.diploma_cancel_timeout_minutes);
                      }
                    }}
                    helperText="Время в минутах, в течение которого регистратор может отменить оплату дипломов"
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
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

