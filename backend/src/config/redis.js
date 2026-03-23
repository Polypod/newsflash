const { createClient } = require('redis');
const logger = require('../utils/logger');

let redisClient;

async function initializeRedis() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  redisClient = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis reconnection failed after 10 attempts');
          return new Error('Redis reconnection failed');
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error:', err);
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected');
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis client reconnecting');
  });

  await redisClient.connect();
  return redisClient;
}

function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call initializeRedis() first.');
  }
  return redisClient;
}

module.exports = {
  initializeRedis,
  getRedisClient,
  redisClient
};
