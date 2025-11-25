import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  Box,
  Typography,
  CircularProgress,
  Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import api from '../services/api';
import { formatDate } from '../utils/format';

interface Participant {
  id: number;
  fullName: string;
  birthDate: string;
}

interface ParticipantModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (participantIds: number[]) => void;
  selectedIds?: number[];
  multiple?: boolean;
}

export const ParticipantModal: React.FC<ParticipantModalProps> = ({
  open,
  onClose,
  onSelect,
  selectedIds = [],
  multiple = true,
}) => {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set(selectedIds));
  const [newParticipant, setNewParticipant] = useState({
    fullName: '',
    birthDate: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      fetchParticipants();
      setSelected(new Set(selectedIds));
    }
  }, [open, selectedIds]);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/participants');
      const items = response.data.items || {};
      const participantsList = Object.keys(items).map((id) => ({
        id: parseInt(id),
        fullName: items[id],
        birthDate: response.data.optAttributes?.[id]?.['data-subtext']?.split(',')[1]?.trim() || '',
      }));
      setParticipants(participantsList);
    } catch (error) {
      console.error('Error fetching participants:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (id: number) => {
    if (!multiple) {
      setSelected(new Set([id]));
      return;
    }

    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const handleSelectAll = () => {
    if (selected.size === filteredParticipants.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredParticipants.map((p) => p.id)));
    }
  };

  const handleCreate = async () => {
    if (!newParticipant.fullName || !newParticipant.birthDate) {
      return;
    }

    setCreating(true);
    try {
      const response = await api.post('/api/participants', {
        fullName: newParticipant.fullName,
        birthDate: newParticipant.birthDate,
      });
      setNewParticipant({ fullName: '', birthDate: '' });
      fetchParticipants();
      if (!multiple) {
        setSelected(new Set([response.data.id]));
      }
    } catch (error: any) {
      console.error('Error creating participant:', error);
      alert(error.response?.data?.error || 'Ошибка создания участника');
    } finally {
      setCreating(false);
    }
  };

  const handleConfirm = () => {
    onSelect(Array.from(selected));
    onClose();
  };

  const filteredParticipants = participants.filter((p) =>
    p.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {multiple ? 'Выбор участников' : 'Выбор участника'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <TextField
            fullWidth
            placeholder="Поиск участников..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            }}
          />
        </Box>

        <Box sx={{ mb: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Создать нового участника
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="ФИО *"
                value={newParticipant.fullName}
                onChange={(e) => setNewParticipant({ ...newParticipant, fullName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Дата рождения *"
                type="date"
                value={newParticipant.birthDate}
                onChange={(e) => setNewParticipant({ ...newParticipant, birthDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                fullWidth
                variant="contained"
                size="small"
                onClick={handleCreate}
                disabled={creating || !newParticipant.fullName || !newParticipant.birthDate}
                startIcon={creating ? <CircularProgress size={16} /> : <AddIcon />}
              >
                Создать
              </Button>
            </Grid>
          </Grid>
        </Box>

        {multiple && (
          <Box sx={{ mb: 1 }}>
            <Button size="small" onClick={handleSelectAll}>
              {selected.size === filteredParticipants.length ? 'Снять все' : 'Выбрать все'}
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ display: 'inline', ml: 2 }}>
              Выбрано: {selected.size}
            </Typography>
          </Box>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredParticipants.length === 0 ? (
              <ListItem>
                <ListItemText primary="Участники не найдены" />
              </ListItem>
            ) : (
              filteredParticipants.map((participant) => (
                <ListItem
                  key={participant.id}
                  button
                  onClick={() => handleToggle(participant.id)}
                  selected={selected.has(participant.id)}
                >
                  <Checkbox checked={selected.has(participant.id)} />
                  <ListItemText
                    primary={participant.fullName}
                    secondary={participant.birthDate ? formatDate(participant.birthDate) : 'Дата рождения не указана'}
                  />
                </ListItem>
              ))
            )}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={handleConfirm} disabled={selected.size === 0}>
          Выбрать ({selected.size})
        </Button>
      </DialogActions>
    </Dialog>
  );
};


