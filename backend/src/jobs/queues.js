const Queue = require('bull');
const logger = require('../utils/logger');
const config = require('../config/env');

// Redis configuration for Bull
const redisConfig = {
  redis: {
    port: 6379,
    host: config.redisUrl.replace('redis://', '').split(':')[0] || 'localhost',
    password: config.redisUrl.includes('@') ? config.redisUrl.split('@')[0].split('//')[1] : undefined
  }
};

// Create queues
const conflictQueue = new Queue('acled-conflicts', redisConfig);
const castQueue     = new Queue('acled-cast', redisConfig);
const ucdpQueue     = new Queue('ucdp-ged', redisConfig);
const energyQueue   = new Queue('eia-energy', redisConfig);
const flightQueue   = new Queue('aviation-flights', redisConfig);
const newsQueue     = new Queue('news-ingestion', redisConfig);
const analysisQueue = new Queue('ai-analysis', redisConfig);

// Queue event handlers
const setupQueueEvents = (queue, queueName) => {
  queue.on('completed', (job, result) => {
    logger.info(`Job ${job.id} completed in queue ${queueName}`, { result });
  });

  queue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} failed in queue ${queueName}`, { error: err.message });
  });

  queue.on('stalled', (job) => {
    logger.warn(`Job ${job.id} stalled in queue ${queueName}`);
  });

  queue.on('error', (error) => {
    logger.error(`Queue ${queueName} error:`, error);
  });
};

// Setup event handlers for all queues
setupQueueEvents(conflictQueue, 'acled-conflicts');
setupQueueEvents(castQueue, 'acled-cast');
setupQueueEvents(ucdpQueue, 'ucdp-ged');
setupQueueEvents(energyQueue, 'eia-energy');
setupQueueEvents(flightQueue, 'aviation-flights');
setupQueueEvents(newsQueue, 'news-ingestion');
setupQueueEvents(analysisQueue, 'ai-analysis');

// Job processors
conflictQueue.process(async (job) => {
  const acledService = require('../services/acledService');
  const { getDbPool } = require('../config/database');
  const { startDate, endDate, limit } = job.data;

  logger.info('Processing conflict sync job', { startDate, endDate, limit });

  const conflicts = await acledService.fetchConflicts({
    startDate: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate,
    limit: limit || 1000,
  });

  if (!conflicts.length) {
    logger.warn('Conflict sync: no conflicts returned from ACLED');
    return { processed: 0, timestamp: new Date().toISOString() };
  }

  const pool = getDbPool();
  let upserted = 0;

  for (const c of conflicts) {
    if (!c.external_id) continue;
    const [lon, lat] = c.location?.coordinates || [0, 0];
    if (!lon && !lat) continue;

    await pool.query(
      `INSERT INTO conflicts
         (source, external_id, title, description, event_type, severity,
          location, region, country, event_date, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,
               ST_SetSRID(ST_MakePoint($7,$8),4326),
               $9,$10,$11,NOW())
       ON CONFLICT (external_id) DO UPDATE SET
         title       = EXCLUDED.title,
         severity    = EXCLUDED.severity,
         event_date  = EXCLUDED.event_date`,
      [
        'acled', c.external_id, c.title, c.description,
        c.event_type, c.severity,
        lon, lat,
        c.region, c.country,
        c.event_date || null,
      ]
    );
    upserted++;
  }

  logger.info(`Conflict sync complete: ${upserted} ACLED conflicts upserted`);
  return { processed: upserted, timestamp: new Date().toISOString() };
});

// CAST sync: fetch all-country forecasts from ACLED and upsert into cast_forecasts table.
// ACLED updates CAST weekly; we mirror that schedule.
castQueue.process(async (job) => {
  const acledService = require('../services/acledService');
  const { getDbPool } = require('../config/database');
  const { region } = job.data;

  logger.info('Processing CAST sync job', { region: region || 'global' });

  const forecasts = await acledService.fetchCAST({ region });

  if (!forecasts.length) {
    logger.warn('CAST sync: no forecasts returned');
    return { processed: 0, timestamp: new Date().toISOString() };
  }

  const pool = getDbPool();
  let upserted = 0;

  for (const f of forecasts) {
    if (!f.country || !f.year || !f.month) continue;
    await pool.query(
      `INSERT INTO cast_forecasts
         (country, admin1, year, month, total_forecast, battles_forecast, erv_forecast, vac_forecast, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (country, COALESCE(admin1, ''), year, month)
       DO UPDATE SET
         total_forecast    = EXCLUDED.total_forecast,
         battles_forecast  = EXCLUDED.battles_forecast,
         erv_forecast      = EXCLUDED.erv_forecast,
         vac_forecast      = EXCLUDED.vac_forecast,
         fetched_at        = NOW()`,
      [
        f.country,
        f.admin1 || null,
        f.year,
        f.month,
        f.total_forecast   || 0,
        f.battles_forecast || 0,
        f.erv_forecast     || 0,
        f.vac_forecast     || 0,
      ]
    );
    upserted++;
  }

  logger.info(`CAST sync complete: ${upserted} records upserted`);
  return { processed: upserted, timestamp: new Date().toISOString() };
});

// UCDP GED sync: fetch recent events and upsert into ucdp_events + dyadic tables.
// GED is released annually; we sync the last 90 days to catch any dataset corrections
// and populate newly added events from the current version.
ucdpQueue.process(async (job) => {
  const ucdpService = require('../services/ucdpService');
  const { getDbPool } = require('../config/database');

  const { startDate } = job.data;
  const pool = getDbPool();

  // Default: last 90 days of GED events (dataset goes to 2024-12-31 in v25.1)
  const effectiveStart = startDate
    || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  logger.info('Processing UCDP GED sync job', { startDate: effectiveStart });

  const { events, totalCount } = await ucdpService.fetchGEDEvents({
    startDate: effectiveStart,
    pagesize:  1000,
  });

  if (!events.length) {
    logger.warn('UCDP GED sync: no events returned', { startDate: effectiveStart });
    return { processed: 0, timestamp: new Date().toISOString() };
  }

  let upserted = 0;
  for (const e of events) {
    if (!e.external_id) continue;
    const [lon, lat] = e.location.coordinates;
    await pool.query(
      `INSERT INTO ucdp_events
         (external_id, conflict_name, dyad_name, type_of_violence, event_type, severity,
          location, region, country, admin1, event_date, date_end,
          side_a, side_b, fatalities_best, fatalities_low, fatalities_high,
          source_headline, source_article, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,
               ST_SetSRID(ST_MakePoint($7,$8),4326),$9,$10,$11,$12,$13,
               $14,$15,$16,$17,$18,$19,$20,NOW())
       ON CONFLICT (external_id) DO UPDATE SET
         conflict_name    = EXCLUDED.conflict_name,
         fatalities_best  = EXCLUDED.fatalities_best,
         fatalities_low   = EXCLUDED.fatalities_low,
         fatalities_high  = EXCLUDED.fatalities_high,
         fetched_at       = NOW()`,
      [
        e.external_id, e.conflict_name, e.dyad_name,
        e.type_of_violence, e.event_type, e.severity,
        lon, lat,
        e.region, e.country, e.admin1,
        e.event_date || null, e.date_end || null,
        e.actors?.[0] || null, e.actors?.[1] || null,
        e.fatalities || 0, e.fatalities_low || 0, e.fatalities_high || 0,
        e.source_headline || null, e.source_article || null,
      ]
    );
    upserted++;
  }

  // Sync dyadic conflicts for the current year
  const currentYear = new Date().getFullYear() - 1; // GED data lags by one year
  const dyadic = await ucdpService.fetchDyadicConflicts({ year: currentYear });
  let dyadicUpserted = 0;
  for (const d of dyadic) {
    if (!d.dyad_id || !d.year) continue;
    await pool.query(
      `INSERT INTO ucdp_dyadic_conflicts
         (dyad_id, conflict_id, location, side_a, side_b, incompatibility,
          intensity_level, type_of_conflict, year, start_date, region, version, fetched_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (dyad_id, year) DO UPDATE SET
         intensity_level = EXCLUDED.intensity_level,
         fetched_at      = NOW()`,
      [
        d.dyad_id, d.conflict_id || null, d.location || null,
        d.side_a || null, d.side_b || null, d.incompatibility || null,
        d.intensity_level ? parseInt(d.intensity_level) : null,
        d.type_of_conflict ? parseInt(d.type_of_conflict) : null,
        parseInt(d.year),
        d.start_date || null, d.region || null, d.version || null,
      ]
    );
    dyadicUpserted++;
  }

  logger.info(`UCDP sync complete: ${upserted} GED events, ${dyadicUpserted} dyadic conflicts upserted`);
  return { processed: upserted, dyadic: dyadicUpserted, timestamp: new Date().toISOString() };
});

energyQueue.process(async (job) => {
  const eiaService = require('../services/eiaService');
  const { type } = job.data;
  
  logger.info('Processing energy sync job', { type });
  
  let result = { processed: 0 };
  
  if (type === 'prices' || !type) {
    const oilPrices = await eiaService.fetchOilPrices();
    const gasPrices = await eiaService.fetchNaturalGasPrices();
    result.processed += oilPrices.length + gasPrices.length;
    // TODO: Store prices in database
  }
  
  if (type === 'facilities' || !type) {
    const facilities = await eiaService.fetchProductionFacilities();
    result.processed += facilities.length;
    // TODO: Store facilities in database
  }
  
  logger.info(`Energy sync complete: ${result.processed} records fetched`);
  
  return { ...result, timestamp: new Date().toISOString() };
});

flightQueue.process(async (job) => {
  const aviationService = require('../services/aviationService');
  const { limit, departureIata, arrivalIata } = job.data;
  
  logger.info('Processing flight sync job', { limit, departureIata, arrivalIata });
  
  let flights = [];
  
  if (departureIata && arrivalIata) {
    flights = await aviationService.fetchFlightsByRoute(departureIata, arrivalIata, { limit });
  } else {
    flights = await aviationService.fetchActiveFlights({ limit: limit || 100 });
  }
  
  // TODO: Store flights in database
  logger.info(`Flight sync complete: ${flights.length} flights fetched`);
  
  return { processed: flights.length, timestamp: new Date().toISOString() };
});

newsQueue.process(async (job) => {
  const newsService = require('../services/newsService');
  
  logger.info('Processing news ingestion job');
  
  const articles = await newsService.fetchAndProcess();
  
  // TODO: Store articles in database and Chroma
  logger.info(`News ingestion complete: ${articles.length} articles fetched`);
  
  return { processed: articles.length, timestamp: new Date().toISOString() };
});

analysisQueue.process(async (job) => {
  const { query, options } = job.data;
  
  logger.info('Processing AI analysis job', { query: query.substring(0, 50) });
  
  // TODO: Call AI service for analysis
  // This will be implemented in Phase 4
  
  return { 
    status: 'pending',
    message: 'AI analysis will be implemented in Phase 4',
    timestamp: new Date().toISOString()
  };
});

// Schedule recurring jobs
const scheduleJobs = () => {
  // Conflicts: Hourly sync
  conflictQueue.add({}, {
    repeat: { cron: '0 * * * *' },
    removeOnComplete: 100,
    removeOnFail: 50
  });

  // CAST forecasts: Weekly sync (Mondays 06:00 UTC — ACLED publishes Monday mornings)
  castQueue.add({}, {
    repeat: { cron: '0 6 * * 1' },
    removeOnComplete: 10,
    removeOnFail: 5
  });
  // Also run once on startup so the table is populated immediately
  castQueue.add({ startup: true }, { delay: 10_000 });

  // UCDP GED: Daily sync (02:00 UTC) — catches dataset corrections and new annual releases
  ucdpQueue.add({}, {
    repeat: { cron: '0 2 * * *' },
    removeOnComplete: 10,
    removeOnFail: 5
  });
  // Startup run after 20s (after CAST starts at 10s)
  ucdpQueue.add({ startup: true }, { delay: 20_000 });
  
  // Energy: Daily sync
  energyQueue.add({}, { 
    repeat: { cron: '0 0 * * *' },
    removeOnComplete: 100,
    removeOnFail: 50
  });
  
  // Aviation: Real-time (every 5 min)
  flightQueue.add({}, { 
    repeat: { every: 5 * 60 * 1000 },
    removeOnComplete: 100,
    removeOnFail: 50
  });
  
  // News ingestion: Every 30 minutes
  newsQueue.add({}, { 
    repeat: { every: 30 * 60 * 1000 },
    removeOnComplete: 100,
    removeOnFail: 50
  });
  
  logger.info('Recurring jobs scheduled');
};

// Get queue statistics
const getQueueStats = async () => {
  const stats = {};
  
  const queues = [
    { name: 'conflicts', queue: conflictQueue },
    { name: 'energy', queue: energyQueue },
    { name: 'flights', queue: flightQueue },
    { name: 'news', queue: newsQueue },
    { name: 'analysis', queue: analysisQueue }
  ];
  
  for (const { name, queue } of queues) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount()
    ]);
    
    stats[name] = { waiting, active, completed, failed };
  }
  
  return stats;
};

module.exports = {
  conflictQueue,
  castQueue,
  ucdpQueue,
  energyQueue,
  flightQueue,
  newsQueue,
  analysisQueue,
  scheduleJobs,
  getQueueStats
};
