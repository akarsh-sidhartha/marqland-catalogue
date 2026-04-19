const express = require('express');
const router  = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// All log routes require admin
router.use(authenticate, authorize(['admin']));

/**
 * GET /api/logs
 * Query params:
 *   page      (default 1)
 *   limit     (default 50, max 200)
 *   category  filter by category
 *   action    filter by action keyword
 *   userId    filter by user
 *   success   true|false
 *   from      ISO date string
 *   to        ISO date string
 *   search    text search across summary, userEmail, userName
 */
router.get('/', async (req, res) => {
  try {
    const page    = Math.max(1, parseInt(req.query.page)  || 1);
    const limit   = Math.min(200, parseInt(req.query.limit) || 50);
    const skip    = (page - 1) * limit;
    const filter  = {};

    if (req.query.category) filter.category  = req.query.category;
    if (req.query.action)   filter.action    = { $regex: req.query.action, $options: 'i' };
    if (req.query.userId)   filter.userId    = req.query.userId;
    if (req.query.success !== undefined) filter.success = req.query.success === 'true';

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to)   filter.createdAt.$lte = new Date(req.query.to);
    }

    if (req.query.search) {
      const re = { $regex: req.query.search, $options: 'i' };
      filter.$or = [{ summary: re }, { userEmail: re }, { userName: re }, { path: re }];
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ActivityLog.countDocuments(filter),
    ]);

    res.json({ logs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/logs/stats
 * Returns summary stats for the dashboard widgets.
 */
router.get('/stats', async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // last 7 days

    const [
      totalLast7,
      byCategory,
      byUser,
      failedLast7,
      recentActions,
    ] = await Promise.all([
      ActivityLog.countDocuments({ createdAt: { $gte: since } }),
      ActivityLog.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ActivityLog.aggregate([
        { $match: { createdAt: { $gte: since }, userId: { $ne: null } } },
        { $group: { _id: '$userId', name: { $first: '$userName' }, email: { $first: '$userEmail' }, role: { $first: '$userRole' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      ActivityLog.countDocuments({ createdAt: { $gte: since }, success: false }),
      ActivityLog.find({ createdAt: { $gte: since } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('summary userName userRole createdAt category success')
        .lean(),
    ]);

    res.json({ totalLast7, byCategory, byUser, failedLast7, recentActions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/logs/purge
 * Delete logs older than N days (default 90).
 */
router.delete('/purge', async (req, res) => {
  try {
    const days   = parseInt(req.query.days) || 90;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const result = await ActivityLog.deleteMany({ createdAt: { $lt: cutoff } });
    res.json({ message: `Purged ${result.deletedCount} log entries older than ${days} days.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;