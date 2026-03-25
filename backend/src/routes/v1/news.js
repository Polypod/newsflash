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

const LEVEL_FILTERS = {
  critical: 'na.criticality_score >= 85',
  high:     'na.criticality_score BETWEEN 65 AND 84',
  medium:   'na.criticality_score BETWEEN 40 AND 64',
  all:      '1=1',
};

// GET /api/v1/news/headlines
router.get('/headlines', async (req, res, next) => {
  try {
    const { level: rawLevel = 'all', limit = 50 } = req.query;
    const redisClient = getRedisClient();
    const pool = getDbPool();

    const VALID_LEVELS = new Set(['critical', 'high', 'medium', 'all']);
    const level = VALID_LEVELS.has(rawLevel) ? rawLevel : 'all';

    const cacheKey = `news:headlines:${level}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const scoreFilter = LEVEL_FILTERS[level];
    const query = `
      SELECT id, source, title, content, url, published_at,
             criticality_score, criticality_reason, source_type
      FROM news_articles na
      WHERE source_type IN ('newsapi-top', 'tiingo')
        AND ${scoreFilter}
      ORDER BY COALESCE(criticality_score, 0) DESC, published_at DESC
      LIMIT $1
    `;
    const result = await pool.query(query, [parseInt(limit, 10)]);
    const response = { articles: result.rows };

    await redisClient.setEx(cacheKey, 60, JSON.stringify(response));
    res.json(response);
  } catch (error) {
    logger.error('Error fetching headlines:', error);
    next(error);
  }
});

module.exports = router;
