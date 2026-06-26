import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const RENDER_URL = 'https://virelchat-7jy1.onrender.com';

function resolveApiUrl(): string {
  if (typeof window === 'undefined') return '';
  const fromWindow = (window as any).__API_URL;
  if (fromWindow) return fromWindow;
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv) return fromEnv;
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return RENDER_URL;
  }
  return '';
}

const API_URL = resolveApiUrl();

export const initSocket = (token: string) => {
  if (socket?.connected) return socket;

  socket = io(API_URL || undefined, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};
