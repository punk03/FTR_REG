import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Container } from '@mui/material';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <Container>
          <Box sx={{ mt: 4, textAlign: 'center' }}>
            <Typography variant="h4" gutterBottom>
              Произошла ошибка
            </Typography>
            <Typography variant="body1" color="error" sx={{ mb: 2 }}>
              {this.state.error?.message || 'Неизвестная ошибка'}
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Перезагрузить страницу
            </Button>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}


