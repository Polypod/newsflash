import { io } from 'socket.io-client';

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.listeners = new Map();
  }

  connect(url, options = {}) {
    if (this.socket?.connected) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const wsUrl = url || import.meta.env.VITE_WS_URL || 'ws://localhost:3001/ws';

      this.socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
        ...options,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        console.log('WebSocket connected');
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        console.log('WebSocket disconnected:', reason);
      });

      this.socket.on('connect_error', (error) => {
        this.reconnectAttempts++;
        console.error('WebSocket connection error:', error);

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Max reconnection attempts reached'));
        }
      });

      this.socket.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  emit(event, data) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('WebSocket not connected. Cannot emit event:', event);
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);

      // Store listener for cleanup
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);

      // Remove from listeners
      if (this.listeners.has(event)) {
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }
  }

  subscribe(channel) {
    this.emit('subscribe', channel);
  }

  unsubscribe(channel) {
    this.emit('unsubscribe', channel);
  }

  getConnectionStatus() {
    return this.isConnected;
  }

  getSocket() {
    return this.socket;
  }
}

// Create singleton instance
const wsService = new WebSocketService();

export default wsService;
