import { io } from 'socket.io-client';

// Geliştirme: Vite (5173) + Sunucu (3001) ayrı portlarda çalışır
// Üretim / tünel: her şey 3001'den gelir, aynı origin yeterli
const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.DEV
  ? `http://${window.location.hostname}:3001`
  : window.location.origin);

export const socket = io(SERVER_URL, {
  autoConnect: false,
  reconnectionAttempts: 10,
});
