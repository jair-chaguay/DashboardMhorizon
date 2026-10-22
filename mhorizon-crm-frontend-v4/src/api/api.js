import axios from 'axios';
import { clearSession, getToken, notifyAuthExpired } from '../utils/session';

const api = axios.create({
  // Define VITE_API_URL en un archivo .env.local para pruebas locales (ej. http://127.0.0.1:8000/api)
  baseURL: import.meta.env.VITE_API_URL || 'https://api.mhorizon.com.ec/api',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Un 401 en cualquier página cierra la sesión y vuelve al Login
const AUTH_ROUTES = ['/login', '/logout'];
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !AUTH_ROUTES.includes(error.config?.url)) {
      clearSession();
      notifyAuthExpired();
    }
    return Promise.reject(error);
  }
);

export default api;
