const express = require('express');
const router = express.Router();
const { getDbPool } = require('../../config/database');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../utils/logger');

// GET /api/v1/energy/facilities
router.get('/facilities', async (req, res, next) => {
  try {
    const { type, bbox, limit = 1000 } = req.query;
    const redisClient = getRedisClient();
    const pool = getDbPool();

    // Build cache key
    const cacheKey = `energy:facilities:${type || 'all'}:${bbox || 'all'}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Build query
    let query = `
      SELECT id, source, external_id, name, facility_type, 
             ST_AsGeoJSON(location) as location, capacity, status, country, created_at
      FROM energy_facilities
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (type) {
      query += ` AND facility_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      query += ` AND location && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)`;
      params.push(minLon, minLat, maxLon, maxLat);
      paramIndex += 4;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    
    const response = {
      data: result.rows.map(row => ({
        ...row,
        location: JSON.parse(row.location)
      }))
    };

    // Cache for 24 hours
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching energy facilities:', error);
    next(error);
  }
});

// GET /api/v1/energy/prices
router.get('/prices', async (req, res, next) => {
  try {
    const { timeframe = '24h' } = req.query;
    const redisClient = getRedisClient();
    const pool = getDbPool();

    // Build cache key
    const cacheKey = `energy:prices:${timeframe}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Query from analysis_cache or a dedicated prices table
    const result = await pool.query(
      `SELECT * FROM analysis_cache 
       WHERE query_hash LIKE 'energy:prices:%' 
       ORDER BY created_at DESC LIMIT 1`
    );

    const response = {
      data: result.rows[0] || { message: 'No price data available' }
    };

    // Cache for 24 hours
    await redisClient.setEx(cacheKey, 86400, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching energy prices:', error);
    next(error);
  }
});

module.exports = router;
