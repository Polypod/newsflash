const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

async function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL || 
    'postgresql://appuser:devpassword@localhost:5432/conflicts_db';

  pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection
  try {
    const client = await pool.connect();
    logger.info('Database connection established');
    client.release();
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }

  return pool;
}

function getDbPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}

module.exports = {
  initializeDatabase,
  getDbPool,
  pool
};
