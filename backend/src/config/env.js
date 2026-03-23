const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://appuser:devpassword@localhost:5432/conflicts_db',

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',

  // External APIs
  acledEmail: process.env.ACLED_EMAIL,
  acledPassword: process.env.ACLED_PASSWORD,
  eiaApiKey: process.env.EIA_API_KEY,
  aviationstackApiKey: process.env.AVIATIONSTACK_API_KEY,

  // AI Services
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,

  // Mapbox
  mapboxToken: process.env.MAPBOX_TOKEN,

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // AI Service
  aiServiceUrl: process.env.AI_SERVICE_URL || 'http://localhost:8000',
};

// Validate required environment variables in production
if (config.nodeEnv === 'production') {
  const requiredVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

module.exports = config;
