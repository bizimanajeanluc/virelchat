import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const API_URL = (typeof window !== 'undefined' && (window as any).__API_URL) || import.meta.env.VITE_API_URL || '';

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
