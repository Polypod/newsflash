const express = require('express');
const router = express.Router();
const { getDbPool } = require('../../config/database');
const { getRedisClient } = require('../../config/redis');
const logger = require('../../utils/logger');
const acledService = require('../../services/acledService');
const ucdpService  = require('../../services/ucdpService');

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

// GET /api/v1/conflicts/cast
// Live CAST forecasts from ACLED (6 rolling 4-week periods ahead per country).
// Query params: region (slug or code), countries (comma-separated), year, month
router.get('/cast', async (req, res, next) => {
  try {
    const { region, countries, year, month } = req.query;
    const redisClient = getRedisClient();
    const cacheKey = `conflicts:cast:${region || 'all'}:${countries || 'all'}:${year || 'all'}:${month || 'all'}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const forecasts = await acledService.fetchCAST({
      region,
      countries: countries ? countries.split(',').map(c => c.trim()) : undefined,
      year:  year  ? parseInt(year)  : undefined,
      month: month ? parseInt(month) : undefined,
    });

    const response = { data: forecasts, meta: { total: forecasts.length } };
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
    res.json(response);
  } catch (error) {
    logger.error('Error fetching CAST forecasts', { error: error.message });
    next(error);
  }
});

// GET /api/v1/conflicts/aggregated
// Weekly aggregated event/fatality counts from ACLED.
// Query params: region, countries, startDate, endDate, limit
router.get('/aggregated', async (req, res, next) => {
  try {
    const { region, countries, startDate, endDate, limit } = req.query;
    const redisClient = getRedisClient();
    const cacheKey = `conflicts:agg:${region || 'all'}:${countries || 'all'}:${startDate || 'all'}:${endDate || 'all'}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const records = await acledService.fetchAggregated({
      region,
      countries: countries ? countries.split(',').map(c => c.trim()) : undefined,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : undefined,
    });

    const response = { data: records, meta: { total: records.length } };
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
    res.json(response);
  } catch (error) {
    logger.error('Error fetching aggregated conflicts', { error: error.message });
    next(error);
  }
});

// GET /api/v1/conflicts/ucdp-events
// UCDP Georeferenced Event Dataset — state-based, non-state, and one-sided
// violence events with precise lat/lon, source citations, and fatality ranges.
// Covers 1989–2024 (v25.1). Params: startDate, endDate, countryId, typeOfViolence (1/2/3)
router.get('/ucdp-events', async (req, res, next) => {
  try {
    const { startDate, endDate, countryId, typeOfViolence, limit } = req.query;
    const redisClient = getRedisClient();
    const cacheKey = `ucdp:ged:${startDate || 'all'}:${endDate || 'all'}:${countryId || 'all'}:${typeOfViolence || 'all'}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const { events, totalCount } = await ucdpService.fetchGEDEvents({
      startDate,
      endDate,
      countryId: countryId ? countryId.split(',') : undefined,
      typeOfViolence: typeOfViolence ? parseInt(typeOfViolence) : undefined,
      pagesize: limit ? parseInt(limit) : 1000,
    });

    const response = { data: events, meta: { total: totalCount, returned: events.length } };
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(response));
    res.json(response);
  } catch (error) {
    logger.error('Error fetching UCDP GED events', { error: error.message });
    next(error);
  }
});

// GET /api/v1/conflicts/ucdp-context
// Combined UCDP conflict context: active dyadic conflicts + non-state + one-sided
// violence for the given year/region. Useful for the AI agents' background context.
// Params: year (defaults to current), region
router.get('/ucdp-context', async (req, res, next) => {
  try {
    const { year, region } = req.query;
    const redisClient = getRedisClient();
    const cacheKey = `ucdp:ctx:${year || 'cur'}:${region || 'all'}`;

    const cached = await redisClient.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const effectiveYear = year ? parseInt(year) : new Date().getFullYear() - 1;

    const [dyadic, nonstate, onesided] = await Promise.all([
      ucdpService.fetchDyadicConflicts({ year: effectiveYear, region }),
      ucdpService.fetchNonstateConflicts({ year: effectiveYear, region }),
      ucdpService.fetchOnesidedViolence({ year: effectiveYear, region }),
    ]);

    const response = {
      data: { dyadic, nonstate, onesided },
      meta: {
        year: effectiveYear,
        dyadic_count: dyadic.length,
        nonstate_count: nonstate.length,
        onesided_count: onesided.length,
      },
    };
    // Cache 6h — UCDP data is annual, no need for frequent refresh
    await redisClient.setEx(cacheKey, 6 * 3600, JSON.stringify(response));
    res.json(response);
  } catch (error) {
    logger.error('Error fetching UCDP context', { error: error.message });
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
