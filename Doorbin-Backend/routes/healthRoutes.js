const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

/**
 * @swagger
 * tags:
 *   name: Health & System
 *   description: System health check and uptime status APIs
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: System Health Check (GET)
 *     description: Checks system uptime, active environment, and MongoDB database connectivity status.
 *     tags: [Health & System]
 *     responses:
 *       200:
 *         description: System operational and healthy
 *   head:
 *     summary: System Health Check (HEAD for UptimeRobot / Pingdom)
 *     description: Lightweight headers-only health check for UptimeRobot monitoring.
 *     tags: [Health & System]
 *     responses:
 *       200:
 *         description: System operational (Returns 200 OK headers)
 */

const handleHealthCheck = (req, res) => {
  const readyStateMap = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };

  const dbState = mongoose.connection.readyState;
  const isDbConnected = dbState === 1;

  const healthInfo = {
    status: isDbConnected ? 'UP' : 'DEGRADED',
    system: 'Doorbin Visuals - Collaborative Project Management System',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: readyStateMap[dbState] || 'Unknown',
      readyState: dbState,
      dbName: mongoose.connection.name || 'doorbin'
    },
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    timestamp: new Date(),
    swaggerDocs: `${req.protocol}://${req.get('host')}/api-docs`
  };

  const httpStatus = isDbConnected ? 200 : 503;

  if (req.method === 'HEAD') {
    res.setHeader('Content-Type', 'application/json');
    return res.status(httpStatus).end();
  }

  return res.status(httpStatus).json(healthInfo);
};

router.route('/')
  .get(handleHealthCheck)
  .head(handleHealthCheck);

module.exports = router;

// Diagnostic speed endpoints for performance investigation
router.get('/health', (req, res) => {
  res.status(200).json({ success: true, timestamp: Date.now() });
});

router.get('/test-speed', (req, res) => {
  res.status(200).json({ success: true, message: "API speed test" });
});

router.get('/db-speed', async (req, res) => {
  try {
    const start = process.hrtime.bigint();
    await mongoose.connection.db.command({ ping: 1 });
    const end = process.hrtime.bigint();
    const mongoPingMs = Number(end - start) / 1_000_000;
    res.status(200).json({ success: true, mongoPingMs: Number(mongoPingMs.toFixed(2)) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
