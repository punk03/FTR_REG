import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Stepper,
  Step,
  StepLabel,
  Button,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  IconButton,
  Chip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import RestoreIcon from '@mui/icons-material/Restore';
import api from '../services/api';
import { AutoCompleteTextField } from '../components/AutoCompleteTextField';
import { Event } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { formatDate } from '../utils/format';

const steps = [
  'Информация о коллективе',
  'Участники',
  'Направление',
  'Информация о номере',
  'Соглашения',
];

export const RegistrationForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [disciplines, setDisciplines] = useState<any[]>([]);
  const [nominations, setNominations] = useState<any[]>([]);
  const [ages, setAges] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Form data
  const [formData, setFormData] = useState({
    eventId: '',
    collectiveName: '',
    accessory: '',
    leaders: '',
    trainers: '',
    disciplineId: '',
    nominationId: '',
    ageId: '',
    categoryId: '',
    danceName: '',
    duration: '',
    participantsCount: '',
    federationParticipantsCount: '0',
    videoUrl: '',
    songUrl: '',
    agreement: false,
    agreement2: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [countInDirection, setCountInDirection] = useState<number | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [loadTemplateDialogOpen, setLoadTemplateDialogOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [eventsRes, disciplinesRes, nominationsRes, agesRes, categoriesRes] = await Promise.all([
          api.get('/api/reference/events?status=ACTIVE'),
          api.get('/api/reference/disciplines'),
          api.get('/api/reference/nominations'),
          api.get('/api/reference/ages'),
          api.get('/api/reference/categories'),
        ]);

        setEvents(eventsRes.data);
        setDisciplines(disciplinesRes.data);
        setNominations(nominationsRes.data);
        setAges(agesRes.data);
        setCategories(categoriesRes.data);

        if (eventsRes.data.length > 0 && !formData.eventId) {
          setFormData((prev) => ({ ...prev, eventId: String(eventsRes.data[0].id) }));
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (id) {
      const fetchRegistration = async () => {
        try {
          const response = await api.get(`/api/registrations/${id}`);
          const reg = response.data;
          setFormData({
            eventId: String(reg.eventId),
            collectiveName: reg.collective?.name || '',
            accessory: reg.collective?.accessory || '',
            leaders: reg.leaders?.map((l: any) => l.person.fullName).join(', ') || '',
            trainers: reg.trainers?.map((t: any) => t.person.fullName).join(', ') || '',
            disciplineId: String(reg.disciplineId),
            nominationId: String(reg.nominationId),
            ageId: String(reg.ageId),
            categoryId: reg.categoryId ? String(reg.categoryId) : '',
            danceName: reg.danceName || '',
            duration: reg.duration || '',
            participantsCount: String(reg.participantsCount),
            federationParticipantsCount: String(reg.federationParticipantsCount),
            videoUrl: reg.videoUrl || '',
            songUrl: reg.songUrl || '',
            agreement: reg.agreement,
            agreement2: reg.agreement2,
          });
        } catch (error) {
          console.error('Error fetching registration:', error);
        }
      };
      fetchRegistration();
    } else {
      // При создании новой регистрации проверяем наличие черновиков и шаблонов
      fetchDrafts();
      fetchTemplates();
    }
  }, [id]);

  // Загрузка черновиков
  const fetchDrafts = async () => {
    try {
      const response = await api.get('/api/registrations/drafts');
      setDrafts(response.data);
      if (response.data.length > 0) {
        setDraftDialogOpen(true);
      }
    } catch (error) {
      console.error('Error fetching drafts:', error);
    }
  };

  // Восстановление черновика
  const restoreDraft = useCallback(async (draft: any) => {
    try {
      if (draft.formData) {
        const parsedData = JSON.parse(draft.formData);
        setFormData(parsedData);
        setDraftId(draft.id);
        setDraftDialogOpen(false);
        showSuccess('Черновик восстановлен');
      }
    } catch (error) {
      console.error('Error restoring draft:', error);
      showError('Ошибка восстановления черновика');
    }
  }, [showSuccess, showError]);

  // Автосохранение черновика
  const saveDraft = useCallback(async () => {
    if (id) return; // Не сохраняем черновики при редактировании существующей регистрации

    setSavingDraft(true);
    try {
      const formDataJson = JSON.stringify(formData);
      const response = await api.post('/api/registrations/draft', {
        draftId: draftId,
        eventId: formData.eventId,
        formData: formDataJson,
      });
      setDraftId(response.data.draftId);
    } catch (error) {
      console.error('Error saving draft:', error);
    } finally {
      setSavingDraft(false);
    }
  }, [formData, draftId, id]);

  // Автосохранение с debounce
  useEffect(() => {
    if (id) return; // Не автосохраняем при редактировании

    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
    }

    // Автосохранение через 2 секунды после последнего изменения
    draftSaveTimeoutRef.current = setTimeout(() => {
      if (formData.eventId || formData.collectiveName) {
        saveDraft();
      }
    }, 2000);

    return () => {
      if (draftSaveTimeoutRef.current) {
        clearTimeout(draftSaveTimeoutRef.current);
      }
    };
  }, [formData, id, saveDraft]);

  // Удаление черновика
  const deleteDraft = async (draftIdToDelete: number) => {
    try {
      await api.delete(`/api/registrations/drafts/${draftIdToDelete}`);
      setDrafts(drafts.filter((d) => d.id !== draftIdToDelete));
      if (draftId === draftIdToDelete) {
        setDraftId(null);
      }
      showSuccess('Черновик удален');
    } catch (error) {
      console.error('Error deleting draft:', error);
      showError('Ошибка удаления черновика');
    }
  };

  // Загрузка шаблонов
  const fetchTemplates = async () => {
    try {
      const response = await api.get('/api/registrations/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  // Применение шаблона
  const applyTemplate = useCallback(async (template: any) => {
    try {
      const templateData = JSON.parse(template.formData);
      setFormData((prev) => ({
        ...prev,
        ...templateData,
        // Не перезаписываем eventId если он уже выбран
        eventId: prev.eventId || templateData.eventId || '',
      }));
      setLoadTemplateDialogOpen(false);
      showSuccess('Шаблон применен');
    } catch (error) {
      console.error('Error applying template:', error);
      showError('Ошибка применения шаблона');
    }
  }, [showSuccess, showError]);

  // Удаление шаблона
  const deleteTemplate = async (templateId: number) => {
    try {
      await api.delete(`/api/registrations/templates/${templateId}`);
      setTemplates(templates.filter((t) => t.id !== templateId));
      showSuccess('Шаблон удален');
    } catch (error) {
      console.error('Error deleting template:', error);
      showError('Ошибка удаления шаблона');
    }
  };

  useEffect(() => {
    const checkCountInDirection = async () => {
      if (
        formData.eventId &&
        formData.disciplineId &&
        formData.nominationId &&
        formData.ageId
      ) {
        try {
          const response = await api.post('/api/registrations/count-in-direction', {
            eventId: parseInt(formData.eventId),
            disciplineId: parseInt(formData.disciplineId),
            nominationId: parseInt(formData.nominationId),
            ageId: parseInt(formData.ageId),
            categoryId: formData.categoryId ? parseInt(formData.categoryId) : undefined,
          });
          setCountInDirection(response.data.count);
        } catch (error) {
          console.error('Error checking count:', error);
        }
      } else {
        setCountInDirection(null);
      }
    };

    if (activeStep >= 2) {
      checkCountInDirection();
    }
  }, [formData.eventId, formData.disciplineId, formData.nominationId, formData.ageId, formData.categoryId, activeStep]);

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!formData.eventId) newErrors.eventId = 'Выберите событие';
      if (!formData.collectiveName) newErrors.collectiveName = 'Введите название коллектива';
    }

    if (step === 2) {
      if (!formData.disciplineId) newErrors.disciplineId = 'Выберите дисциплину';
      if (!formData.nominationId) newErrors.nominationId = 'Выберите номинацию';
      if (!formData.ageId) newErrors.ageId = 'Выберите возрастную категорию';
    }

    if (step === 4) {
      if (!formData.agreement) newErrors.agreement = 'Необходимо согласие';
      if (!formData.agreement2) newErrors.agreement2 = 'Необходимо согласие';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep(activeStep)) {
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        eventId: parseInt(formData.eventId),
        collectiveName: formData.collectiveName,
        accessory: formData.accessory || undefined,
        leaders: formData.leaders || undefined,
        trainers: formData.trainers || undefined,
        disciplineId: parseInt(formData.disciplineId),
        nominationId: parseInt(formData.nominationId),
        ageId: parseInt(formData.ageId),
        categoryId: formData.categoryId ? parseInt(formData.categoryId) : undefined,
        danceName: formData.danceName || undefined,
        duration: formData.duration || undefined,
        participantsCount: formData.participantsCount ? parseInt(formData.participantsCount) : undefined,
        federationParticipantsCount: parseInt(formData.federationParticipantsCount),
        videoUrl: formData.videoUrl || undefined,
        songUrl: formData.songUrl || undefined,
        agreement: formData.agreement,
        agreement2: formData.agreement2,
      };

      if (id) {
        await api.patch(`/api/registrations/${id}`, payload);
        showSuccess('Регистрация успешно обновлена');
      } else {
        await api.post('/api/registrations', payload);
        showSuccess('Регистрация успешно создана');
        
        // Удаляем черновик после успешного создания регистрации
        if (draftId) {
          try {
            await api.delete(`/api/registrations/drafts/${draftId}`);
          } catch (error) {
            console.error('Error deleting draft after registration:', error);
          }
        }
      }

      navigate('/registrations');
    } catch (error: any) {
      console.error('Error saving registration:', error);
      if (error.response?.data?.errors) {
        const apiErrors: Record<string, string> = {};
        error.response.data.errors.forEach((err: any) => {
          apiErrors[err.param] = err.msg;
        });
        setErrors(apiErrors);
      } else {
        showError(error.response?.data?.error || 'Ошибка сохранения регистрации');
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth error={!!errors.eventId}>
                <InputLabel>Событие *</InputLabel>
                <Select
                  value={formData.eventId}
                  label="Событие *"
                  onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                >
                  {events.map((event) => (
                    <MenuItem key={event.id} value={String(event.id)}>
                      {event.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <AutoCompleteTextField
                label="Коллектив *"
                value={formData.collectiveName}
                onChange={(value) => setFormData({ ...formData, collectiveName: value })}
                endpoint="/api/suggestions/collectives"
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.name)}
                error={!!errors.collectiveName}
                helperText={errors.collectiveName}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Принадлежность коллектива"
                value={formData.accessory}
                onChange={(e) => setFormData({ ...formData, accessory: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Руководители"
                value={formData.leaders}
                onChange={(e) => setFormData({ ...formData, leaders: e.target.value })}
                placeholder="ФИО через запятую"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Тренеры"
                value={formData.trainers}
                onChange={(e) => setFormData({ ...formData, trainers: e.target.value })}
                placeholder="ФИО через запятую"
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Количество участников"
                type="number"
                value={formData.participantsCount}
                onChange={(e) => setFormData({ ...formData, participantsCount: e.target.value })}
                helperText="Автоматически определяется по номинации"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Федеральных участников"
                type="number"
                value={formData.federationParticipantsCount}
                onChange={(e) => setFormData({ ...formData, federationParticipantsCount: e.target.value })}
                inputProps={{ min: 0 }}
              />
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <Grid container spacing={2}>
            {countInDirection !== null && countInDirection > 0 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  В этом направлении уже зарегистрировано заявок: {countInDirection}
                </Alert>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.disciplineId}>
                <InputLabel>Дисциплина *</InputLabel>
                <Select
                  value={formData.disciplineId}
                  label="Дисциплина *"
                  onChange={(e) => setFormData({ ...formData, disciplineId: e.target.value })}
                >
                  {disciplines.map((d) => (
                    <MenuItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.nominationId}>
                <InputLabel>Номинация *</InputLabel>
                <Select
                  value={formData.nominationId}
                  label="Номинация *"
                  onChange={(e) => {
                    setFormData({ ...formData, nominationId: e.target.value });
                    // Auto-set participants count based on nomination
                    const nomination = nominations.find((n) => n.id === parseInt(e.target.value));
                    if (nomination) {
                      const name = nomination.name.toLowerCase();
                      if (name.includes('соло')) {
                        setFormData((prev) => ({ ...prev, nominationId: e.target.value, participantsCount: '1' }));
                      } else if (name.includes('дуэт') || name.includes('пара')) {
                        setFormData((prev) => ({ ...prev, nominationId: e.target.value, participantsCount: '2' }));
                      } else if (name.includes('трио')) {
                        setFormData((prev) => ({ ...prev, nominationId: e.target.value, participantsCount: '3' }));
                      } else if (name.includes('квартет')) {
                        setFormData((prev) => ({ ...prev, nominationId: e.target.value, participantsCount: '4' }));
                      }
                    }
                  }}
                >
                  {nominations.map((n) => (
                    <MenuItem key={n.id} value={String(n.id)}>
                      {n.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth error={!!errors.ageId}>
                <InputLabel>Возрастная категория *</InputLabel>
                <Select
                  value={formData.ageId}
                  label="Возрастная категория *"
                  onChange={(e) => setFormData({ ...formData, ageId: e.target.value })}
                >
                  {ages.map((a) => (
                    <MenuItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Категория</InputLabel>
                <Select
                  value={formData.categoryId}
                  label="Категория"
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                >
                  <MenuItem value="">Не выбрано</MenuItem>
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      case 3:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Название танца"
                value={formData.danceName}
                onChange={(e) => setFormData({ ...formData, danceName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Длительность"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                placeholder="MM:SS или HH:MM:SS"
                helperText="Формат: MM:SS или HH:MM:SS"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="URL видео"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                type="url"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="URL песни"
                value={formData.songUrl}
                onChange={(e) => setFormData({ ...formData, songUrl: e.target.value })}
                type="url"
              />
            </Grid>
          </Grid>
        );

      case 4:
        return (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.agreement}
                    onChange={(e) => setFormData({ ...formData, agreement: e.target.checked })}
                  />
                }
                label="Согласие на обработку персональных данных *"
              />
              {errors.agreement && (
                <Typography variant="caption" color="error">
                  {errors.agreement}
                </Typography>
              )}
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.agreement2}
                    onChange={(e) => setFormData({ ...formData, agreement2: e.target.checked })}
                  />
                }
                label="Согласие на публикацию *"
              />
              {errors.agreement2 && (
                <Typography variant="caption" color="error">
                  {errors.agreement2}
                </Typography>
              )}
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/registrations')}>
          Назад к списку
        </Button>
      </Box>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          {id ? 'Редактирование регистрации' : 'Создание регистрации'}
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mt: 3, mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ mb: 3 }}>{renderStepContent()}</Box>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2 }}>
          <Button 
            disabled={activeStep === 0} 
            onClick={handleBack} 
            startIcon={<ArrowBackIcon />}
            fullWidth={window.innerWidth < 600}
          >
            Назад
          </Button>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', width: { xs: '100%', sm: 'auto' }, flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap' }}>
            {!id && (
              <>
                <Button
                  variant="outlined"
                  onClick={() => { setLoadTemplateDialogOpen(true); fetchTemplates(); }}
                  startIcon={<BookmarkIcon />}
                  fullWidth={window.innerWidth < 600}
                >
                  Загрузить шаблон
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setTemplateDialogOpen(true)}
                  disabled={!formData.eventId}
                  startIcon={<BookmarkBorderIcon />}
                  fullWidth={window.innerWidth < 600}
                >
                  Сохранить как шаблон
                </Button>
                <Button
                  variant="outlined"
                  onClick={saveDraft}
                  disabled={savingDraft}
                  startIcon={savingDraft ? <CircularProgress size={20} /> : <SaveIcon />}
                  fullWidth={window.innerWidth < 600}
                >
                  {savingDraft ? 'Сохранение...' : 'Сохранить черновик'}
                </Button>
              </>
            )}
            {activeStep === steps.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                fullWidth={window.innerWidth < 600}
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </Button>
            ) : (
              <Button 
                variant="contained" 
                onClick={handleNext} 
                endIcon={<ArrowForwardIcon />}
                fullWidth={window.innerWidth < 600}
              >
                Далее
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Диалог выбора черновика */}
      <Dialog open={draftDialogOpen} onClose={() => setDraftDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Восстановить черновик?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            У вас есть сохраненные черновики регистраций. Хотите восстановить один из них?
          </Typography>
          <List>
            {drafts.map((draft) => (
              <ListItem
                key={draft.id}
                secondaryAction={
                  <IconButton edge="end" onClick={() => deleteDraft(draft.id)}>
                    <DeleteIcon />
                  </IconButton>
                }
              >
                <ListItemButton onClick={() => restoreDraft(draft)}>
                  <ListItemText
                    primary={`Черновик от ${formatDate(draft.updatedAt)}`}
                    secondary={
                      draft.eventId
                        ? `Событие: ${events.find((e) => e.id === draft.eventId)?.name || 'Неизвестно'}`
                        : 'Без события'
                    }
                  />
                  <RestoreIcon sx={{ ml: 2 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDraftDialogOpen(false)}>Создать новую регистрацию</Button>
        </DialogActions>
      </Dialog>

      {/* Диалог сохранения шаблона */}
      <Dialog open={templateDialogOpen} onClose={() => { setTemplateDialogOpen(false); setTemplateName(''); }}>
        <DialogTitle>Сохранить как шаблон</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название шаблона"
            fullWidth
            variant="standard"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setTemplateDialogOpen(false); setTemplateName(''); }}>Отмена</Button>
          <Button
            onClick={async () => {
              if (!templateName.trim()) return;
              try {
                await api.post('/api/registrations/templates', {
                  name: templateName,
                  collectiveName: formData.collectiveName,
                  accessory: formData.accessory,
                  disciplineId: formData.disciplineId || undefined,
                  nominationId: formData.nominationId || undefined,
                  ageId: formData.ageId || undefined,
                  categoryId: formData.categoryId || undefined,
                  danceName: formData.danceName,
                  duration: formData.duration,
                  participantsCount: formData.participantsCount || '0',
                  federationParticipantsCount: formData.federationParticipantsCount || '0',
                  leaders: formData.leaders ? formData.leaders.split(',').map((s: string) => s.trim()).filter((s: string) => s) : [],
                  trainers: formData.trainers ? formData.trainers.split(',').map((s: string) => s.trim()).filter((s: string) => s) : [],
                  videoUrl: formData.videoUrl,
                  songUrl: formData.songUrl,
                  agreement: formData.agreement,
                  agreement2: formData.agreement2,
                });
                showSuccess('Шаблон успешно сохранен');
                setTemplateDialogOpen(false);
                setTemplateName('');
                await fetchTemplates();
              } catch (error: any) {
                console.error('Error saving template:', error);
                showError(error.response?.data?.error || 'Ошибка сохранения шаблона');
              }
            }}
            variant="contained"
            disabled={!templateName.trim()}
          >
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог выбора шаблона */}
      <Dialog open={loadTemplateDialogOpen} onClose={() => setLoadTemplateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Загрузить шаблон</DialogTitle>
        <DialogContent>
          {templates.length === 0 ? (
            <Typography variant="body2" sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}>
              У вас пока нет сохраненных шаблонов
            </Typography>
          ) : (
            <List>
              {templates.map((template) => (
                <ListItem
                  key={template.id}
                  secondaryAction={
                    <IconButton edge="end" onClick={() => deleteTemplate(template.id)}>
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemButton onClick={() => applyTemplate(template)}>
                    <ListItemText
                      primary={template.name}
                      secondary={`Создан: ${formatDate(template.createdAt)}`}
                    />
                    <RestoreIcon sx={{ ml: 2 }} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLoadTemplateDialogOpen(false)}>Отмена</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

