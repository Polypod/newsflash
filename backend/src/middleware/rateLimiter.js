const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

const rateLimiter = async (req, res, next) => {
  try {
    const redisClient = getRedisClient();
    const ip = req.ip || req.connection.remoteAddress;
    const key = `rate_limit:${ip}`;
    
    const current = await redisClient.get(key);
    
    if (current && parseInt(current) > 100) {
      return res.status(429).json({
        status: 'error',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later'
      });
    }
    
    if (current) {
      await redisClient.incr(key);
    } else {
      await redisClient.set(key, 1, { EX: 900 }); // 15 minutes
    }
    
    next();
  } catch (error) {
    logger.error('Rate limiter error:', error);
    // If Redis fails, allow the request to proceed
    next();
  }
};

module.exports = { rateLimiter };
