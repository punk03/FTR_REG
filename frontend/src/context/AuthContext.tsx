import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../services/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      console.log('Checking auth, token exists:', !!token);
      if (token) {
        console.log('Making API call to /api/auth/me');
        const response = await api.get('/api/auth/me');
        console.log('Auth check successful, user:', response.data);
        setUser(response.data);
      } else {
        console.log('No token found, user not authenticated');
      }
    } catch (error: any) {
      console.error('Auth check failed:', error);
      console.error('Error details:', error.response?.data || error.message);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
      console.log('Auth check completed, loading set to false');
    }
  };

  const login = async (email: string, password: string) => {
    try {
      console.log('Login attempt for email:', email);
      console.log('API base URL:', api.defaults.baseURL);
      console.log('Making POST request to /api/auth/login');
      
      const response = await api.post('/api/auth/login', { email, password });
      
      console.log('Login response received:', response.status, response.data);
      
      if (!response.data) {
        throw new Error('No data in response');
      }
      
      const { accessToken, refreshToken, user: userData } = response.data;

      if (!accessToken || !refreshToken) {
        throw new Error('Missing tokens in response');
      }

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(userData);
      
      console.log('Login successful, user set:', userData);
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error response:', error.response);
      console.error('Error message:', error.message);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


