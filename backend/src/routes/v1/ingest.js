const express = require('express');
const router = express.Router();
const { getDbPool } = require('../../config/database');
const { scoringQueue } = require('../../jobs/queues');
const config = require('../../config/env');
const logger = require('../../utils/logger');

router.post('/articles', async (req, res, next) => {
  // Guard: if INTERNAL_API_KEY is not configured, refuse all requests to
  // avoid authenticating everyone via undefined === undefined.
  if (!config.internalApiKey) {
    return res.status(503).json({ error: 'Service not configured' });
  }
  if (req.headers['x-internal-key'] !== config.internalApiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { articles } = req.body;
  if (!Array.isArray(articles)) {
    return res.status(400).json({ error: 'articles array required' });
  }

  const pool = getDbPool();
  let inserted = 0;
  let skipped = 0;

  for (const a of articles) {
    try {
      const result = await pool.query(
        `INSERT INTO news_articles
           (source, external_id, title, content, url, published_at, category, author, source_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (external_id) DO NOTHING
         RETURNING id`,
        [a.source, a.external_id, a.title, a.content, a.url,
         a.published_at, a.category, a.author, a.source_type],
      );
      if (result.rows.length > 0) {
        inserted++;
        try {
          await scoringQueue.add(
            { articleId: result.rows[0].id },
            { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
          );
        } catch (queueErr) {
          logger.error('ingest: queue error', { external_id: a.external_id, err: queueErr.message });
        }
      } else {
        skipped++;
      }
    } catch (err) {
      logger.error('ingest: DB error', { external_id: a.external_id, err: err.message });
      return next(err);
    }
  }

  res.json({ inserted, skipped });
});

module.exports = router;
