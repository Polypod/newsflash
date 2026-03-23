const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getDbPool } = require('../../config/database');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../utils/logger');
const config = require('../../config/env');

// POST /api/v1/analyze/situation
router.post('/situation', async (req, res, next) => {
  try {
    const { query, include_infrastructure = true, threat_level_threshold = 'medium' } = req.body;
    const redisClient = getRedisClient();
    const pool = getDbPool();

    if (!query) {
      return res.status(400).json({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Query is required'
      });
    }

    // Generate cache key from query
    const crypto = require('crypto');
    const queryHash = crypto.createHash('md5').update(query).digest('hex');
    const cacheKey = `analysis:${queryHash}`;

    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Call AI service
    const aiServiceUrl = config.aiServiceUrl || 'http://localhost:8000';
    
    const response = await axios.post(`${aiServiceUrl}/analyze/situation`, {
      query,
      include_infrastructure,
      threat_level_threshold
    }, {
      timeout: 30000 // 30 second timeout
    });

    const result = response.data;

    // Cache result for 24 hours
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(result));

    // Store in analysis_cache table
    await pool.query(
      `INSERT INTO analysis_cache (query_hash, geopolitical_events, threat_assessment, recommendations, execution_time_ms, token_usage, cost_usd)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (query_hash) DO UPDATE SET
         geopolitical_events = $2,
         threat_assessment = $3,
         recommendations = $4,
         execution_time_ms = $5,
         token_usage = $6,
         cost_usd = $7,
         created_at = NOW(),
         expires_at = NOW() + INTERVAL '24 hours'`,
      [
        queryHash,
        JSON.stringify(result.geopolitical_events || []),
        JSON.stringify(result.threat_assessment || {}),
        JSON.stringify(result.recommendations || []),
        result.execution_time_ms || 0,
        result.token_usage || 0,
        result.cost_usd || 0
      ]
    );

    res.json(result);
  } catch (error) {
    logger.error('Error analyzing situation:', error);
    
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({
        status: 'error',
        code: 'SERVICE_UNAVAILABLE',
        message: 'AI service is unavailable'
      });
    }
    
    next(error);
  }
});

module.exports = router;
