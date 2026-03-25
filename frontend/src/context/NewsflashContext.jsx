import { createContext, useState, useEffect, useCallback } from 'react';
import wsService from '../services/wsService';

export const NewsflashContext = createContext({ toasts: [], dismiss: () => {} });

export function NewsflashProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((_toastId) => {
    setToasts((prev) => prev.filter((t) => t._toastId !== _toastId));
  }, []);

  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
    const token = localStorage.getItem('auth_token');
    wsService.connect(wsUrl, { auth: { token } }).catch(() => {});
    wsService.subscribe('news');

    const handleNewsflash = (payload) => {
      const toastId = Date.now();
      setToasts((prev) => {
        const next = [{ ...payload, _toastId: toastId }, ...prev];
        return next.slice(0, 3); // keep newest 3
      });
    };

    wsService.on('newsflash', handleNewsflash);
    return () => {
      wsService.off('newsflash', handleNewsflash);
      wsService.unsubscribe('news');
    };
  }, []);

  return (
    <NewsflashContext.Provider value={{ toasts, dismiss }}>
      {children}
    </NewsflashContext.Provider>
  );
}
