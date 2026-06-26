import axios from 'axios';

const RENDER_URL = 'https://virelchat-7jy1.onrender.com';

function resolveApiUrl(): string {
  if (typeof window === 'undefined') return '';
  const fromWindow = (window as any).__API_URL;
  if (fromWindow) return fromWindow;
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) return fromEnv;
  // If running on a non-localhost domain (e.g. Vercel), default to Render
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return RENDER_URL;
  }
  return '';
}

const API_URL = resolveApiUrl();

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
