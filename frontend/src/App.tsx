import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { RegistrationsList } from './pages/RegistrationsList';
import { RegistrationDetails } from './pages/RegistrationDetails';
import { RegistrationForm } from './pages/RegistrationForm';
import { Accounting } from './pages/Accounting';
import { Diplomas } from './pages/Diplomas';
import { Statistics } from './pages/Statistics';
import { Admin } from './pages/Admin';
import { CombinedPayment } from './pages/CombinedPayment';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationProvider } from './context/NotificationContext';
import { createAppTheme } from './theme';

const THEME_STORAGE_KEY = 'ftr_theme_mode';

// Загрузить тему из localStorage
const loadThemeMode = (): boolean => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved !== null) {
      return saved === 'dark';
    }
  } catch (error) {
    console.error('Error loading theme from localStorage:', error);
  }
  // По умолчанию светлая тема
  return false;
};

const AppRoutes: React.FC = () => {
  const [darkMode, setDarkMode] = useState(loadThemeMode);
  const theme = createAppTheme(darkMode);

  // Сохранить тему в localStorage при изменении
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, darkMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme to localStorage:', error);
    }
  }, [darkMode]);

  console.log('AppRoutes rendering');

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout 
                  darkMode={darkMode} 
                  toggleDarkMode={() => {
                    setDarkMode((prev) => !prev);
                  }} 
                />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="registrations" element={<RegistrationsList />} />
            <Route path="registrations/new" element={<RegistrationForm />} />
            <Route path="registrations/:id" element={<RegistrationDetails />} />
            <Route path="registrations/:id/edit" element={<RegistrationForm />} />
            <Route path="accounting" element={<Accounting />} />
            <Route path="combined-payment" element={<CombinedPayment />} />
            <Route path="diplomas" element={<Diplomas />} />
            <Route path="statistics" element={<Statistics />} />
            <Route path="admin" element={<ProtectedRoute roles={['ADMIN']}><Admin /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

function App() {
  console.log('App component rendering');
  
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default App;

