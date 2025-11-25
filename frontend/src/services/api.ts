import axios, { AxiosInstance, AxiosError } from 'axios';

// API URL - use environment variable or default to localhost:3001
// In production build, VITE_API_URL should be set in .env file
// @ts-ignore - Vite environment variable
const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3001';

console.log('API URL:', API_URL);

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Clear tokens and redirect to login
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;


