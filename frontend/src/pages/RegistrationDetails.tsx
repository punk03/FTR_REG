import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Chip,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HistoryIcon from '@mui/icons-material/History';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import api from '../services/api';
import { Registration } from '../types';
import { formatDate, formatCurrency } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const RegistrationDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceCalculation, setPriceCalculation] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    const fetchRegistration = async () => {
      try {
        const response = await api.get(`/api/registrations/${id}`);
        setRegistration(response.data);
        fetchPriceCalculation(response.data);
      } catch (error) {
        console.error('Error fetching registration:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchRegistration();
    }
  }, [id]);

  const fetchPriceCalculation = async (reg: any) => {
    try {
      const response = await api.get(`/api/registrations/${reg.id}/calculate-price`);
      setPriceCalculation(response.data);
    } catch (error) {
      console.error('Error calculating price:', error);
    }
  };

  const fetchHistory = async () => {
    if (!id || historyExpanded) return;
    
    setHistoryLoading(true);
    try {
      const response = await api.get(`/api/registrations/${id}/history`);
      setHistory(response.data);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleHistoryToggle = (expanded: boolean) => {
    setHistoryExpanded(expanded);
    if (expanded && history.length === 0) {
      fetchHistory();
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'Создание';
      case 'UPDATE':
        return 'Изменение';
      case 'DELETE':
        return 'Удаление';
      case 'STATUS_CHANGE':
        return 'Изменение статуса';
      default:
        return action;
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/registrations/${id}`);
      showSuccess('Регистрация успешно удалена');
      navigate('/registrations');
    } catch (error: any) {
      console.error('Error deleting registration:', error);
      showError(error.response?.data?.error || 'Ошибка удаления регистрации');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!registration) {
    return (
      <Box>
        <Typography variant="h6">Регистрация не найдена</Typography>
        <Button onClick={() => navigate('/registrations')}>Вернуться к списку</Button>
      </Box>
    );
  }

  const reg: any = registration;
  const canEdit = user?.role === 'ADMIN' || user?.role === 'REGISTRATOR';
  const canDelete = user?.role === 'ADMIN';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/registrations')}>
          Назад к списку
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canEdit && (
            <Button
              variant="contained"
              startIcon={<EditIcon />}
              onClick={() => navigate(`/registrations/${id}/edit`)}
            >
              Редактировать
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Удалить
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Регистрация №{reg.number || '-'}
            </Typography>
            <Divider sx={{ my: 2 }} />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Коллектив
                </Typography>
                <Typography variant="body1">{reg.collective?.name || '-'}</Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Название танца
                </Typography>
                <Typography variant="body1">{reg.danceName || '-'}</Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Дисциплина
                </Typography>
                <Typography variant="body1">{reg.discipline?.name || '-'}</Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Номинация
                </Typography>
                <Typography variant="body1">{reg.nomination?.name || '-'}</Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Возрастная категория
                </Typography>
                <Typography variant="body1">{reg.age?.name || '-'}</Typography>
              </Grid>

              {reg.category && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Категория
                  </Typography>
                  <Typography variant="body1">{reg.category?.name || '-'}</Typography>
                </Grid>
              )}

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Количество участников
                </Typography>
                <Typography variant="body1">
                  {reg.participantsCount || 0}
                  {reg.federationParticipantsCount > 0 && (
                    <span> ({reg.federationParticipantsCount} федеральных)</span>
                  )}
                </Typography>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Typography variant="body2" color="text.secondary">
                  Длительность
                </Typography>
                <Typography variant="body1">{reg.duration || '-'}</Typography>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Руководители
                </Typography>
                <Typography variant="body1">
                  {reg.leaders?.map((l: any) => l.person.fullName).join(', ') || '-'}
                </Typography>
              </Grid>

              {reg.trainers && reg.trainers.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Тренеры
                  </Typography>
                  <Typography variant="body1">
                    {reg.trainers.map((t: any) => t.person.fullName).join(', ')}
                  </Typography>
                </Grid>
              )}

              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Статус оплаты
                </Typography>
                <Chip
                  label={
                    reg.paymentStatus === 'PAID'
                      ? 'Оплачено'
                      : reg.paymentStatus === 'PERFORMANCE_PAID'
                      ? 'Выступление оплачено'
                      : reg.paymentStatus === 'DIPLOMAS_PAID'
                      ? 'Дипломы оплачены'
                      : 'Не оплачено'
                  }
                  color={
                    reg.paymentStatus === 'PAID'
                      ? 'success'
                      : reg.paymentStatus === 'UNPAID'
                      ? 'error'
                      : 'warning'
                  }
                  size="small"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Статус регистрации
                </Typography>
                <Chip
                  label={
                    reg.status === 'APPROVED'
                      ? 'Одобрено'
                      : reg.status === 'REJECTED'
                      ? 'Отклонено'
                      : 'На рассмотрении'
                  }
                  color={reg.status === 'APPROVED' ? 'success' : reg.status === 'REJECTED' ? 'error' : 'default'}
                  size="small"
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary">
                  Дата создания
                </Typography>
                <Typography variant="body1">{formatDate(reg.createdAt)}</Typography>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          {priceCalculation && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Расчет стоимости
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Выступление
                  </Typography>
                  <Typography variant="h6">{formatCurrency(priceCalculation.performancePrice)}</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Дипломы и медали
                  </Typography>
                  <Typography variant="h6">{formatCurrency(priceCalculation.diplomasAndMedalsPrice)}</Typography>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Box>
                  <Typography variant="body1" fontWeight="bold">
                    Итого
                  </Typography>
                  <Typography variant="h5">{formatCurrency(priceCalculation.total)}</Typography>
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* История изменений */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Accordion expanded={historyExpanded} onChange={(_, expanded) => handleHistoryToggle(expanded)}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HistoryIcon />
              <Typography variant="h6">История изменений</Typography>
              {history.length > 0 && (
                <Chip label={history.length} size="small" color="primary" />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {historyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : history.length === 0 ? (
              <Typography color="text.secondary">История изменений пуста</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Дата</TableCell>
                      <TableCell>Действие</TableCell>
                      <TableCell>Пользователь</TableCell>
                      <TableCell>Измененные поля</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {history.map((entry: any) => (
                      <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.createdAt)}</TableCell>
                        <TableCell>
                          <Chip
                            label={getActionLabel(entry.action)}
                            size="small"
                            color={
                              entry.action === 'CREATE'
                                ? 'success'
                                : entry.action === 'DELETE'
                                ? 'error'
                                : 'default'
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {entry.user?.name || entry.user?.email || '-'}
                          {entry.user?.role && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {entry.user.role}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {entry.changedFields && entry.changedFields.length > 0 ? (
                            <Box>
                              {entry.changedFields.map((field: string, idx: number) => (
                                <Chip
                                  key={idx}
                                  label={field}
                                  size="small"
                                  sx={{ mr: 0.5, mb: 0.5 }}
                                />
                              ))}
                            </Box>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </AccordionDetails>
        </Accordion>
      </Paper>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Подтверждение удаления"
        message="Вы уверены, что хотите удалить эту регистрацию? Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </Box>
  );
};

