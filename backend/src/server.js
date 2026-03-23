const app = require('./app');
const http = require('http');
const { initializeDatabase } = require('./config/database');
const { initializeRedis } = require('./config/redis');
const SocketHandler = require('./websocket/socketHandler');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    logger.info('Database connected successfully');

    // Initialize Redis connection
    const redisClient = await initializeRedis();
    logger.info('Redis connected successfully');

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize WebSocket handler
    const socketHandler = new SocketHandler(server, redisClient);
    logger.info('WebSocket handler initialized');

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received. Starting graceful shutdown...`);
      
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close database connections
      try {
        const { pool } = require('./config/database');
        await pool.end();
        logger.info('Database pool closed');
      } catch (err) {
        logger.error('Error closing database pool:', err);
      }

      // Close Redis connection
      try {
        await redisClient.quit();
        logger.info('Redis connection closed');
      } catch (err) {
        logger.error('Error closing Redis connection:', err);
      }

      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
