import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  console.log('ProtectedRoute render:', { loading, isAuthenticated, user: user?.email, roles });

  if (loading) {
    console.log('ProtectedRoute: showing loading screen');
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Загрузка...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: not authenticated, redirecting to login');
    return <Navigate to="/login" replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    console.log('ProtectedRoute: insufficient permissions, redirecting to home');
    return <Navigate to="/" replace />;
  }

  console.log('ProtectedRoute: rendering children');
  return <>{children}</>;
};


