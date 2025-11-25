import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Alert,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import api from '../services/api';
import { Event } from '../types';
import { useNotification } from '../context/NotificationContext';

interface ExcelImportDialogProps {
  open: boolean;
  onClose: () => void;
  events: Event[];
  onImportComplete?: () => void;
}

interface PreviewRow {
  rowNumber: number;
  categoryString?: string;
  collective?: string;
  danceName?: string;
  participantsCount?: number;
  errors: string[];
  parsed?: {
    disciplineName?: string;
    nominationName?: string;
    ageName?: string;
    categoryName?: string;
  };
}

export const ExcelImportDialog: React.FC<ExcelImportDialogProps> = ({
  open,
  onClose,
  events,
  onImportComplete,
}) => {
  const { showSuccess, showError } = useNotification();
  const [selectedEventId, setSelectedEventId] = useState<number | ''>('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: Array<{ row: number; error: string }>;
  } | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview([]);
      setImportResult(null);
    }
  };

  const handlePreview = async () => {
    if (!file || !selectedEventId) {
      showError('Выберите файл и мероприятие');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('eventId', String(selectedEventId));
      formData.append('dryRun', 'true');

      const response = await api.post('/api/excel-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPreview(response.data.preview || []);
      if (response.data.errors > 0) {
        showError(`Найдено ${response.data.errors} строк с ошибками`);
      }
    } catch (error: any) {
      console.error('Error previewing file:', error);
      showError(error.response?.data?.error || 'Ошибка предпросмотра файла');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !selectedEventId) {
      showError('Выберите файл и мероприятие');
      return;
    }

    if (preview.length === 0) {
      showError('Сначала выполните предпросмотр');
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('eventId', String(selectedEventId));
      formData.append('dryRun', 'false');
      formData.append('deleteExisting', String(deleteExisting));

      const response = await api.post('/api/excel-import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setImportResult({
        imported: response.data.imported,
        skipped: response.data.skipped,
        errors: response.data.errors || [],
      });

      if (response.data.imported > 0) {
        showSuccess(`Успешно импортировано ${response.data.imported} регистраций`);
      }
      if (response.data.skipped > 0) {
        showError(`Пропущено ${response.data.skipped} регистраций из-за ошибок`);
      }

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error: any) {
      console.error('Error importing file:', error);
      showError(error.response?.data?.error || 'Ошибка импорта файла');
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setImportResult(null);
    setDeleteExisting(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Импорт регистраций из Excel</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <FormControl fullWidth>
            <InputLabel>Мероприятие</InputLabel>
            <Select
              value={selectedEventId}
              label="Мероприятие"
              onChange={(e) => setSelectedEventId(e.target.value as number)}
            >
              {events.map((event) => (
                <MenuItem key={event.id} value={event.id}>
                  {event.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box>
            <input
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              id="excel-file-upload"
              type="file"
              onChange={handleFileChange}
            />
            <label htmlFor="excel-file-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<CloudUploadIcon />}
                fullWidth
              >
                {file ? file.name : 'Выберите Excel файл'}
              </Button>
            </label>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Формат: .xlsx, .xls (максимум 100 MB)
            </Typography>
          </Box>

          {file && selectedEventId && (
            <Box>
              <Button
                variant="contained"
                onClick={handlePreview}
                disabled={loading}
                sx={{ mb: 2 }}
              >
                {loading ? <CircularProgress size={20} /> : 'Предпросмотр'}
              </Button>
            </Box>
          )}

          {preview.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Предпросмотр ({preview.length} строк)
              </Typography>
              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Строка</TableCell>
                      <TableCell>Коллектив</TableCell>
                      <TableCell>Название</TableCell>
                      <TableCell>Дисциплина</TableCell>
                      <TableCell>Номинация</TableCell>
                      <TableCell>Возраст</TableCell>
                      <TableCell>Категория</TableCell>
                      <TableCell>Участники</TableCell>
                      <TableCell>Ошибки</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>{row.collective || '-'}</TableCell>
                        <TableCell>{row.danceName || '-'}</TableCell>
                        <TableCell>{row.parsed?.disciplineName || '-'}</TableCell>
                        <TableCell>{row.parsed?.nominationName || '-'}</TableCell>
                        <TableCell>{row.parsed?.ageName || '-'}</TableCell>
                        <TableCell>{row.parsed?.categoryName || '-'}</TableCell>
                        <TableCell>{row.participantsCount || '-'}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 ? (
                            <Chip
                              label={`${row.errors.length} ошибок`}
                              color="error"
                              size="small"
                            />
                          ) : (
                            <Chip label="OK" color="success" size="small" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {preview.some((r) => r.errors.length > 0) && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  Некоторые строки содержат ошибки. Они будут пропущены при импорте.
                </Alert>
              )}

              <FormControlLabel
                control={
                  <Checkbox
                    checked={deleteExisting}
                    onChange={(e) => setDeleteExisting(e.target.checked)}
                  />
                }
                label="Удалить существующие регистрации мероприятия перед импортом"
                sx={{ mt: 2 }}
              />

              <Button
                variant="contained"
                color="primary"
                onClick={handleImport}
                disabled={importing}
                fullWidth
                sx={{ mt: 2 }}
              >
                {importing ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Импорт...
                  </>
                ) : (
                  'Импортировать'
                )}
              </Button>
            </Box>
          )}

          {importResult && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Результаты импорта
              </Typography>
              <Typography>Импортировано: {importResult.imported}</Typography>
              <Typography>Пропущено: {importResult.skipped}</Typography>
              {importResult.errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Ошибки:</Typography>
                  {importResult.errors.slice(0, 10).map((error, index) => (
                    <Typography key={index} variant="body2" color="error">
                      Строка {error.row}: {error.error}
                    </Typography>
                  ))}
                  {importResult.errors.length > 10 && (
                    <Typography variant="body2" color="text.secondary">
                      ... и еще {importResult.errors.length - 10} ошибок
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
};


