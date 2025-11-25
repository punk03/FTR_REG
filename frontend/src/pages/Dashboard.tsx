import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Link,
} from '@mui/material';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import api from '../services/api';
import { Event, Registration } from '../types';
import { formatDate } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { showError } = useNotification();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEvents, setActiveEvents] = useState<Event[]>([]);
  const [recentRegistrations, setRecentRegistrations] = useState<Registration[]>([]);
  const [unpaidRegistrations, setUnpaidRegistrations] = useState<Registration[]>([]);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch active events
      const eventsResponse = await api.get('/api/reference/events?status=ACTIVE');
      const activeEventsData = eventsResponse.data || [];
      setActiveEvents(activeEventsData);
      setEvents(eventsResponse.data || []);

      // Fetch recent registrations (last 10)
      if (activeEventsData.length > 0) {
        const eventId = activeEventsData[0].id;
        
        // Get recent registrations
        const registrationsResponse = await api.get('/api/registrations', {
          params: { eventId, limit: 10, page: 1 },
        });
        setRecentRegistrations(registrationsResponse.data.registrations || []);

        // Get unpaid registrations
        const unpaidResponse = await api.get('/api/registrations', {
          params: { eventId, paymentStatus: 'UNPAID', limit: 10, page: 1 },
        });
        setUnpaidRegistrations(unpaidResponse.data.registrations || []);

        // Get statistics for first active event
        try {
          const statsResponse = await api.get('/api/statistics', {
            params: { eventId },
          });
          setStatistics(statsResponse.data);
        } catch (error) {
          console.error('Error fetching statistics:', error);
        }
      }
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      showError(error.response?.data?.error || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Дашборд
      </Typography>

      {/* Активные мероприятия */}
      {activeEvents.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {activeEvents.map((event) => (
            <Grid item xs={12} sm={6} md={4} key={event.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {event.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(event.startDate)} - {formatDate(event.endDate)}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    sx={{ mt: 2 }}
                    onClick={() => navigate(`/registrations?eventId=${event.id}`)}
                  >
                    Перейти к регистрациям
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Статистика по первому активному мероприятию */}
      {statistics && activeEvents.length > 0 && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" color="text.secondary">
                Всего регистраций
              </Typography>
              <Typography variant="h4">{statistics.overview?.totalRegistrations || 0}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" color="text.secondary">
                Коллективов
              </Typography>
              <Typography variant="h4">{statistics.overview?.totalCollectives || 0}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" color="text.secondary">
                Участников
              </Typography>
              <Typography variant="h4">{statistics.overview?.totalParticipants || 0}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={3}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" color="text.secondary">
                Оплачено
              </Typography>
              <Typography variant="h4" color="success.main">
                {statistics.payments?.paid || 0}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Графики */}
      {statistics && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {statistics.byNomination && statistics.byNomination.length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  По номинациям
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statistics.byNomination}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {statistics.byNomination.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}

          {statistics.byDiscipline && statistics.byDiscipline.length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  По дисциплинам
                </Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={statistics.byDiscipline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          )}
        </Grid>
      )}

      {/* Последние регистрации */}
      {recentRegistrations.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Последние регистрации</Typography>
            <Button size="small" onClick={() => navigate('/registrations')}>
              Все регистрации
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>№</TableCell>
                  <TableCell>Коллектив</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Статус оплаты</TableCell>
                  <TableCell>Дата</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentRegistrations.map((reg: any) => (
                  <TableRow
                    key={reg.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/registrations/${reg.id}`)}
                  >
                    <TableCell>{reg.number || '-'}</TableCell>
                    <TableCell>{reg.collective?.name || '-'}</TableCell>
                    <TableCell>{reg.danceName || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={getPaymentStatusLabel(reg.paymentStatus)}
                        color={getPaymentStatusColor(reg.paymentStatus) as any}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(reg.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Неоплаченные регистрации */}
      {unpaidRegistrations.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" color="error">
              Неоплаченные регистрации ({unpaidRegistrations.length})
            </Typography>
            <Button size="small" onClick={() => navigate('/registrations?paymentStatus=UNPAID')}>
              Все неоплаченные
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>№</TableCell>
                  <TableCell>Коллектив</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Дата</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {unpaidRegistrations.map((reg: any) => (
                  <TableRow
                    key={reg.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/registrations/${reg.id}`)}
                  >
                    <TableCell>{reg.number || '-'}</TableCell>
                    <TableCell>{reg.collective?.name || '-'}</TableCell>
                    <TableCell>{reg.danceName || '-'}</TableCell>
                    <TableCell>{formatDate(reg.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {activeEvents.length === 0 && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Нет активных мероприятий
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Создайте мероприятие в админ-панели, чтобы начать работу
          </Typography>
          {user?.role === 'ADMIN' && (
            <Button variant="contained" onClick={() => navigate('/admin')}>
              Перейти в админ-панель
            </Button>
          )}
        </Paper>
      )}
    </Box>
  );
};

