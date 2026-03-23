const express = require('express');
const router = express.Router();

// Import route modules
const conflictsRoutes = require('./conflicts');
const energyRoutes = require('./energy');
const flightsRoutes = require('./flights');
const analyzeRoutes = require('./analyze');
const correlationsRoutes = require('./correlations');
const newsRoutes = require('./news');

// Mount routes
router.use('/conflicts', conflictsRoutes);
router.use('/energy', energyRoutes);
router.use('/flights', flightsRoutes);
router.use('/analyze', analyzeRoutes);
router.use('/correlations', correlationsRoutes);
router.use('/news', newsRoutes);

module.exports = router;
