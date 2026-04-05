const express = require('express');
const { getSummary, getRecentRecords, getCategories, getTrends } = require('./dashboard.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { requireAuth, requireRole } = require('../../middleware/role.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/summary', requireAuth(), getSummary);
router.get('/recent', requireAuth(), getRecentRecords);

router.get('/categories', requireRole('ANALYST'), getCategories);
router.get('/trends', requireRole('ANALYST'), getTrends);

module.exports = router;
