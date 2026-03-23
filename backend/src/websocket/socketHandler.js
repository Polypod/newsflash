const socketIO = require('socket.io');
const logger = require('../utils/logger');

class SocketHandler {
  constructor(server, redisClient) {
    this.io = socketIO(server, {
      cors: { 
        origin: process.env.FRONTEND_URL || 'http://localhost:5173',
        methods: ['GET', 'POST']
      },
      transports: ['websocket', 'polling']
    });
    this.redisClient = redisClient;
    this.setupHandlers();
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      // Verify JWT token passed as handshake auth
      const token = socket.handshake.auth?.token;
      if (!token) {
        logger.warn('Socket connection rejected: no token', { socketId: socket.id });
        socket.disconnect(true);
        return;
      }

      try {
        const jwt = require('jsonwebtoken');
        socket.user = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        logger.warn('Socket connection rejected: invalid token', { socketId: socket.id });
        socket.disconnect(true);
        return;
      }

      logger.info('User connected', { socketId: socket.id });

      const ALLOWED_CHANNELS = ['conflicts', 'energy', 'flights', 'news', 'threat-alerts'];

      socket.on('subscribe', (channel) => {
        if (!ALLOWED_CHANNELS.includes(channel)) {
          logger.warn('Subscribe rejected: unknown channel', { socketId: socket.id, channel });
          return;
        }
        socket.join(channel);
        logger.info('User subscribed', { socketId: socket.id, channel });
      });

      socket.on('unsubscribe', (channel) => {
        socket.leave(channel);
        logger.info('User unsubscribed', { socketId: socket.id, channel });
      });

      socket.on('disconnect', () => {
        logger.info('User disconnected', { socketId: socket.id });
      });
    });
  }

  broadcastConflictUpdate(data) {
    this.io.to('conflicts').emit('data:update', {
      type: 'conflict',
      timestamp: new Date().toISOString(),
      data
    });
  }

  broadcastThreatAlert(data) {
    this.io.to('threat-alerts').emit('threat-alert', {
      severity: data.severity,
      event: data,
      timestamp: new Date().toISOString()
    });
  }

  broadcastEnergyUpdate(data) {
    this.io.to('energy').emit('data:update', {
      type: 'energy',
      timestamp: new Date().toISOString(),
      data
    });
  }

  broadcastFlightUpdate(data) {
    this.io.to('flights').emit('data:update', {
      type: 'flight',
      timestamp: new Date().toISOString(),
      data
    });
  }
}

module.exports = SocketHandler;
