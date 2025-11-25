import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n/config';

// Debug: Check if root element exists
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found!');
}

// Debug: Log API URL
console.log('Starting app...');
console.log('API URL:', import.meta.env?.VITE_API_URL || 'http://localhost:3001');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);


