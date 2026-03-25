const express = require('express');
const router = express.Router();
const { authenticate } = require('../../middleware/auth');

const conflictsRoutes = require('./conflicts');
const energyRoutes = require('./energy');
const flightsRoutes = require('./flights');
const analyzeRoutes = require('./analyze');
const correlationsRoutes = require('./correlations');
const newsRoutes = require('./news');
const authRoutes = require('./auth');
const ingestRoutes = require('./ingest');

// Public routes
router.use('/auth', authRoutes);
router.use('/conflicts', conflictsRoutes);
router.use('/energy', energyRoutes);
router.use('/flights', flightsRoutes);
router.use('/correlations', correlationsRoutes);
router.use('/news', newsRoutes);
router.use('/ingest', ingestRoutes);

// Protected routes (require JWT)
router.use('/analyze', authenticate, analyzeRoutes);

module.exports = router;
