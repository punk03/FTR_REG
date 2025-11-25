import React, { useState } from 'react';
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

const AppRoutes: React.FC = () => {
  const [darkMode, setDarkMode] = useState(false);
  const theme = createAppTheme(darkMode);

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
                <Layout darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} />
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

