import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useWebSocket(url, options = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      ...options,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
      console.log('WebSocket connected');
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
      console.error('WebSocket connection error:', err);
    });

    socket.on('message', (data) => {
      setLastMessage(data);
    });

    socketRef.current = socket;
  }, [url, options]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const send = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const subscribe = useCallback((channel) => {
    send('subscribe', channel);
  }, [send]);

  const unsubscribe = useCallback((channel) => {
    send('unsubscribe', channel);
  }, [send]);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    error,
    send,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
}
