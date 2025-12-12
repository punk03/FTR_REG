import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, TextField, Button, Box, Typography, Paper, useTheme, useMediaQuery } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showError } = useNotification();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      console.error('Login error in component:', err);
      
      let errorMessage = 'Ошибка входа';
      
      if (err.isNetworkError) {
        errorMessage = 'Не удалось подключиться к серверу. Проверьте подключение к интернету.';
      } else if (err.response) {
        // Есть ответ от сервера
        errorMessage = err.response.data?.error || `Ошибка сервера: ${err.response.status}`;
      } else if (err.message) {
        // Есть сообщение об ошибке
        errorMessage = err.message;
      } else if (err.request) {
        // Запрос отправлен, но нет ответа
        errorMessage = 'Сервер не отвечает. Попробуйте позже.';
      }
      
      console.error('Final error message:', errorMessage);
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ px: { xs: 1, sm: 2 } }}>
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        mt: { xs: 4, sm: 8 },
        minHeight: { xs: 'calc(100vh - 64px)', sm: 'auto' },
        justifyContent: { xs: 'center', sm: 'flex-start' }
      }}>
        <Paper sx={{ 
          p: { xs: 2, sm: 4 }, 
          width: '100%',
          maxWidth: { xs: '100%', sm: '500px' }
        }}>
          <Typography 
            variant={isMobile ? "h5" : "h4"} 
            component="h1" 
            gutterBottom 
            align="center"
            sx={{ fontSize: { xs: '1.5rem', sm: '2rem' } }}
          >
            FTR Registration System
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary" 
            align="center" 
            sx={{ mb: 3, fontSize: { xs: '0.875rem', sm: '1rem' } }}
          >
            Вход в систему
          </Typography>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              autoComplete="email"
              size={isMobile ? "small" : "medium"}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                }
              }}
            />
            <TextField
              fullWidth
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              autoComplete="current-password"
              size={isMobile ? "small" : "medium"}
              sx={{
                '& .MuiInputBase-root': {
                  fontSize: { xs: '16px', sm: '1rem' } // Предотвращает зум на iOS
                }
              }}
            />

            {error && (
              <Typography 
                color="error" 
                sx={{ 
                  mt: 2,
                  fontSize: { xs: '0.875rem', sm: '1rem' },
                  wordBreak: 'break-word'
                }}
              >
                {error}
              </Typography>
            )}

            <Button 
              type="submit" 
              fullWidth 
              variant="contained" 
              sx={{ 
                mt: 3, 
                mb: 2,
                py: { xs: 1.25, sm: 1.5 },
                fontSize: { xs: '0.875rem', sm: '1rem' }
              }} 
              disabled={loading}
              size={isMobile ? "medium" : "large"}
            >
              {loading ? 'Вход...' : 'Войти'}
            </Button>
          </form>

          <Typography 
            variant="body2" 
            color="text.secondary" 
            align="center" 
            sx={{ 
              mt: 2,
              fontSize: { xs: '0.75rem', sm: '0.875rem' },
              px: { xs: 1, sm: 0 }
            }}
          >
            Демо-аккаунты: admin@ftr.ru / admin123
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
};

