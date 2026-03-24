const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const DEV_LIMIT = 10_000;
const PROD_LIMIT = 200;
const WINDOW_SECONDS = 900; // 15 minutes

const rateLimiter = async (req, res, next) => {
  // Skip rate limiting in development
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }

  try {
    const redisClient = getRedisClient();
    const ip = req.ip || req.connection.remoteAddress;
    const key = `rate_limit:${ip}`;
    const limit = PROD_LIMIT;

    const current = await redisClient.get(key);

    if (current && parseInt(current) > limit) {
      return res.status(429).json({
        status: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      });
    }

    if (current) {
      await redisClient.incr(key);
    } else {
      await redisClient.set(key, 1, { EX: WINDOW_SECONDS });
    }

    next();
  } catch (error) {
    logger.error('Rate limiter error:', error);
    next();
  }
};

module.exports = { rateLimiter };
