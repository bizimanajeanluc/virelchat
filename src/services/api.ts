import axios from 'axios';

const API_URL = (typeof window !== 'undefined' && (window as any).__API_URL) || import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://virelchat-7jy1.onrender.com' : '');

const api = axios.create({
  baseURL: API_URL || '/',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
