const express = require('express');
const router = express.Router();
const { getDbPool } = require('../../config/database');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../utils/logger');

// GET /api/v1/flights/active
router.get('/active', async (req, res, next) => {
  try {
    const { bbox, limit = 500 } = req.query;
    const redisClient = getRedisClient();
    const pool = getDbPool();

    // Build cache key
    const cacheKey = `flights:bbox:${bbox || 'all'}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Build query
    let query = `
      SELECT id, flight_number, aircraft_type, 
             ST_AsGeoJSON(location) as location, altitude, speed, timestamp
      FROM flights
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
    `;
    const params = [];
    let paramIndex = 1;

    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      query += ` AND location && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)`;
      params.push(minLon, minLat, maxLon, maxLat);
      paramIndex += 4;
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    
    const response = {
      data: result.rows.map(row => ({
        ...row,
        location: JSON.parse(row.location)
      }))
    };

    // Cache for 5 minutes
    await redisClient.setEx(cacheKey, 300, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching active flights:', error);
    next(error);
  }
});

module.exports = router;
