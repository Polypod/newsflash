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
setupQueueEvents(energyQueue, 'eia-energy');
setupQueueEvents(flightQueue, 'aviation-flights');
setupQueueEvents(newsQueue, 'news-ingestion');
setupQueueEvents(analysisQueue, 'ai-analysis');

// Job processors
conflictQueue.process(async (job) => {
  const acledService = require('../services/acledService');
  const { startDate, endDate, limit } = job.data;
  
  logger.info('Processing conflict sync job', { startDate, endDate, limit });
  
  const conflicts = await acledService.fetchConflicts({
    startDate: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate,
    limit: limit || 1000
  });
  
  // TODO: Store conflicts in database
  logger.info(`Conflict sync complete: ${conflicts.length} conflicts fetched`);
  
  return { processed: conflicts.length, timestamp: new Date().toISOString() };
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
  energyQueue,
  flightQueue,
  newsQueue,
  analysisQueue,
  scheduleJobs,
  getQueueStats
};
