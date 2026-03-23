const express = require('express');
const router = express.Router();
const { getDbPool } = require('../../config/database');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../utils/logger');

// GET /api/v1/conflicts
router.get('/', async (req, res, next) => {
  try {
    const { bbox, startDate, endDate, limit = 1000 } = req.query;
    const redisClient = getRedisClient();
    const pool = getDbPool();

    // Build cache key
    const cacheKey = `conflicts:bbox:${bbox || 'all'}:${startDate || 'all'}:${endDate || 'all'}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Build query
    let query = `
      SELECT id, source, external_id, title, description, event_type, 
             severity, ST_AsGeoJSON(location) as location, region, country, 
             event_date, created_at
      FROM conflicts
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (startDate) {
      query += ` AND event_date >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND event_date <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      query += ` AND location && ST_MakeEnvelope($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, 4326)`;
      params.push(minLon, minLat, maxLon, maxLat);
      paramIndex += 4;
    }

    query += ` ORDER BY event_date DESC LIMIT $${paramIndex}`;
    params.push(parseInt(limit));

    const result = await pool.query(query, params);
    
    const response = {
      data: result.rows.map(row => ({
        ...row,
        location: JSON.parse(row.location)
      })),
      meta: {
        total: result.rows.length,
        hasMore: result.rows.length === parseInt(limit)
      }
    };

    // Cache for 1 hour
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching conflicts:', error);
    next(error);
  }
});

// GET /api/v1/conflicts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const pool = getDbPool();

    const result = await pool.query(
      `SELECT id, source, external_id, title, description, event_type, 
              severity, ST_AsGeoJSON(location) as location, region, country, 
              event_date, created_at
       FROM conflicts
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Conflict not found'
      });
    }

    res.json({
      data: {
        ...result.rows[0],
        location: JSON.parse(result.rows[0].location)
      }
    });
  } catch (error) {
    logger.error('Error fetching conflict:', error);
    next(error);
  }
});

module.exports = router;
