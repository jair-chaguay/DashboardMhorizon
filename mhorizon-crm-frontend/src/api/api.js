// src/services/api.js
import axios from 'axios';

const api = axios.create({
    // baseURL: 'http://127.0.0.1:8000/api', // Usa esta para pruebas locales
    baseURL: 'https://api.mhorizon.com.ec/api',
    headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
    },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AUTH_ROUTES = ['/login', '/logout'];
api.interceptors.response.use(
  (response)=> response,
  (error) =>{
    if(error.response?.status === 401 && !AUTH_ROUTES.includes(error.config?.url)){
      clearSession();
      notifyAuthExpired();
    }
    return Promise.reject(error);
  }
)

export default api;