const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.defaultTTL = 3600; // 1 hour in seconds
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {Promise<any>} - Cached value or null
   */
  async get(key) {
    try {
      const client = getRedisClient();
      const value = await client.get(key);
      
      if (value) {
        logger.debug(`Cache hit for key: ${key}`);
        return JSON.parse(value);
      }
      
      logger.debug(`Cache miss for key: ${key}`);
      return null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (optional)
   */
  async set(key, value, ttl = this.defaultTTL) {
    try {
      const client = getRedisClient();
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await client.setEx(key, ttl, serialized);
      } else {
        await client.set(key, serialized);
      }
      
      logger.debug(`Cache set for key: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error.message);
    }
  }

  /**
   * Delete value from cache
   * @param {string} key - Cache key
   */
  async del(key) {
    try {
      const client = getRedisClient();
      await client.del(key);
      logger.debug(`Cache delete for key: ${key}`);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error.message);
    }
  }

  /**
   * Delete multiple keys by pattern
   * @param {string} pattern - Pattern to match (e.g., 'conflicts:*')
   */
  async delPattern(pattern) {
    try {
      const client = getRedisClient();
      const keys = await client.keys(pattern);
      
      if (keys.length > 0) {
        await client.del(keys);
        logger.debug(`Cache delete pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error.message);
    }
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    try {
      const client = getRedisClient();
      return await client.exists(key);
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error.message);
      return false;
    }
  }

  /**
   * Get or set cache (cache-aside pattern)
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Function to fetch data if not cached
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<any>}
   */
  async getOrSet(key, fetchFn, ttl = this.defaultTTL) {
    try {
      // Try to get from cache first
      const cached = await this.get(key);
      if (cached !== null) {
        return cached;
      }

      // Fetch data if not in cache
      const data = await fetchFn();
      
      // Store in cache
      await this.set(key, data, ttl);
      
      return data;
    } catch (error) {
      logger.error(`Cache getOrSet error for key ${key}:`, error.message);
      // If cache fails, still try to fetch data
      return await fetchFn();
    }
  }

  /**
   * Increment counter in cache
   * @param {string} key - Cache key
   * @param {number} increment - Increment value (default: 1)
   * @returns {Promise<number>} - New value
   */
  async incr(key, increment = 1) {
    try {
      const client = getRedisClient();
      return await client.incrBy(key, increment);
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error.message);
      return 0;
    }
  }

  /**
   * Set expiration for a key
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   */
  async expire(key, ttl) {
    try {
      const client = getRedisClient();
      await client.expire(key, ttl);
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error.message);
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    try {
      const client = getRedisClient();
      const info = await client.info('memory');
      const keyspace = await client.info('keyspace');
      
      return {
        memory: info,
        keyspace: keyspace,
        connected: client.isOpen
      };
    } catch (error) {
      logger.error('Cache stats error:', error.message);
      return { connected: false };
    }
  }

  /**
   * Flush all cache (use with caution)
   */
  async flush() {
    try {
      const client = getRedisClient();
      await client.flushDb();
      logger.warn('Cache flushed');
    } catch (error) {
      logger.error('Cache flush error:', error.message);
    }
  }
}

// Cache key patterns
const CACHE_KEYS = {
  CONFLICTS: (bbox, date) => `conflicts:bbox:${bbox}:${date}`,
  ENERGY_PRICES: (date) => `energy:oil_prices:${date}`,
  ENERGY_FACILITIES: (type) => `energy:facilities:${type}`,
  FLIGHTS: (bbox) => `flights:bbox:${bbox}`,
  CORRELATIONS: (eventId) => `correlation:${eventId}`,
  ANALYSIS: (queryHash) => `analysis:${queryHash}`,
  NEWS: (category) => `news:${category}`
};

// Cache TTLs (in seconds)
const CACHE_TTL = {
  CONFLICTS: 3600, // 1 hour
  ENERGY_PRICES: 86400, // 24 hours
  ENERGY_FACILITIES: 86400, // 24 hours
  FLIGHTS: 300, // 5 minutes
  CORRELATIONS: 21600, // 6 hours
  ANALYSIS: 86400, // 24 hours
  NEWS: 1800 // 30 minutes
};

module.exports = {
  cacheService: new CacheService(),
  CACHE_KEYS,
  CACHE_TTL
};
