const express = require('express');
const router = express.Router();
const { getDbPool } = require('../../config/database');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../utils/logger');

// GET /api/v1/correlations/events/:eventId
router.get('/events/:eventId', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const redisClient = getRedisClient();
    const pool = getDbPool();

    // Build cache key
    const cacheKey = `correlation:${eventId}`;
    
    // Check cache
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Get event details
    const eventResult = await pool.query(
      `SELECT id, title, event_type, severity, ST_AsGeoJSON(location) as location, event_date
       FROM conflicts
       WHERE id = $1`,
      [eventId]
    );

    if (eventResult.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        code: 'NOT_FOUND',
        message: 'Event not found'
      });
    }

    const event = eventResult.rows[0];
    const eventLocation = JSON.parse(event.location);

    // Find nearby infrastructure within 200km
    const infraResult = await pool.query(
      `SELECT id, name, facility_type, 
              ST_AsGeoJSON(location) as location, capacity, status, country,
              ST_Distance(location::geography, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography) / 1000 as distance_km
       FROM energy_facilities
       WHERE ST_DWithin(location::geography, ST_SetSRID(ST_GeomFromGeoJSON($1), 4326)::geography, 200000)
       ORDER BY distance_km ASC
       LIMIT 10`,
      [JSON.stringify(eventLocation)]
    );

    // Calculate correlation scores
    const severityMultiplier = {
      'low': 0.3,
      'medium': 0.6,
      'high': 0.8,
      'critical': 1.0
    }[event.severity] || 0.5;

    const correlations = infraResult.rows.map(infra => {
      const distanceKm = parseFloat(infra.distance_km);
      const correlationScore = Math.max(0, 1.0 - (distanceKm / 200)) * severityMultiplier;
      
      return {
        event_id: eventId,
        infrastructure_id: infra.id,
        infrastructure_name: infra.name,
        infrastructure_type: infra.facility_type,
        distance_km: distanceKm,
        correlation_score: correlationScore,
        risk_assessment: `${event.event_type} (${event.severity}) at ${distanceKm.toFixed(1)}km from ${infra.facility_type}`
      };
    }).filter(c => c.correlation_score > 0.3);

    const response = {
      data: {
        event: {
          ...event,
          location: eventLocation
        },
        correlations
      }
    };

    // Cache for 6 hours
    await redisClient.setEx(cacheKey, 21600, JSON.stringify(response));

    res.json(response);
  } catch (error) {
    logger.error('Error fetching correlations:', error);
    next(error);
  }
});

module.exports = router;
