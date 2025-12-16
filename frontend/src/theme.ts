import { createTheme } from '@mui/material/styles';

export const createAppTheme = (darkMode: boolean) => {
  return createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: {
        fontSize: '2rem',
        '@media (max-width:600px)': {
          fontSize: '1.75rem',
        },
      },
      h2: {
        fontSize: '1.75rem',
        '@media (max-width:600px)': {
          fontSize: '1.5rem',
        },
      },
      h3: {
        fontSize: '1.5rem',
        '@media (max-width:600px)': {
          fontSize: '1.25rem',
        },
      },
      h4: {
        fontSize: '1.25rem',
        '@media (max-width:600px)': {
          fontSize: '1.125rem',
        },
      },
      h5: {
        fontSize: '1.125rem',
        '@media (max-width:600px)': {
          fontSize: '1rem',
        },
      },
      h6: {
        fontSize: '1rem',
        '@media (max-width:600px)': {
          fontSize: '0.875rem',
        },
      },
      body1: {
        fontSize: '1rem',
        '@media (max-width:600px)': {
          fontSize: '0.875rem',
        },
      },
      body2: {
        fontSize: '0.875rem',
        '@media (max-width:600px)': {
          fontSize: '0.75rem',
        },
      },
    },
    components: {
      MuiButton: {
        defaultProps: {
          disableRipple: false, // Можно отключить для больших списков
        },
        styleOverrides: {
          root: {
            '@media (max-width:600px)': {
              fontSize: '0.875rem',
              padding: '8px 16px',
            },
            // Оптимизация transitions
            transition: 'background-color 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms, box-shadow 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            // Оптимизация transitions для Drawer
            transition: 'transform 225ms cubic-bezier(0, 0, 0.2, 1) 0ms !important',
            willChange: 'transform',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          root: {
            // Оптимизация transitions для Dialog
            '& .MuiBackdrop-root': {
              transition: 'opacity 150ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            // Оптимизация hover через CSS вместо JS
            '&:hover': {
              backgroundColor: 'action.hover',
              transition: 'background-color 100ms cubic-bezier(0.4, 0, 0.2, 1) 0ms',
            },
            // Отключить transitions для очень больших таблиц (можно добавить класс)
            '&.no-transition': {
              transition: 'none',
              '&:hover': {
                transition: 'none',
              },
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '@media (max-width:600px)': {
              '& .MuiInputBase-input': {
                fontSize: '16px', // Предотвращает зум на iOS
              },
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            '@media (max-width:600px)': {
              padding: '8px 4px',
              fontSize: '0.75rem',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            '@media (max-width:600px)': {
              padding: '12px',
            },
          },
        },
      },
    },
  });
};


