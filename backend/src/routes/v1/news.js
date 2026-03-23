const express = require('express');
const router = express.Router();
const { getDbPool } = require('../../config/database');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../utils/logger');

// GET /api/v1/news/trending
router.get('/trending', async (req, res, next) => {
  try {
    const { timeframe = '24h', limit = 10, category } = req.query;
    const redisClient = getRedisClient();
    const pool = getDbPool();

    // Build cache key
    const cacheKey = `news:trending:${timeframe}:${category || 'all'}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Calculate time threshold
    const timeThreshold = new Date();
    if (timeframe === '24h') {
      timeThreshold.setHours(timeThreshold.getHours() - 24);
    } else if (timeframe === '7d') {
      timeThreshold.setDate(timeThreshold.getDate() - 7);
    } else if (timeframe === '30d') {
      timeThreshold.setDate(timeThreshold.getDate() - 30);
    }

    // Build query
    let query = `
      SELECT id, source, title, content, url, published_at, 
             sentiment, relevance_score, threat_indicators
      FROM news_articles
      WHERE published_at >= $1
    `;
    const params = [timeThreshold.toISOString()];
    let paramIndex = 2;

    if (category) {
      query += ` AND threat_indicators && $${paramIndex}`;
      params.push([category]);
      paramIndex++;
    }

    query += ` ORDER BY relevance_score DESC, published_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    
    const response = {
      articles: result.rows
    };

    // Cache for 1 hour
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching trending news:', error);
    next(error);
  }
});

module.exports = router;
