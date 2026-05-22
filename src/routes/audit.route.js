const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { listAudit } = require('../controllers/audit.controller');

/**
 * @swagger
 * tags:
 *  name: Audit
 *  description: Audit trail of privileged actions (admin / super_admin only)
 */

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: List audit log entries (admin / super_admin only)
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: action
 *         schema: { type: string }
 *         description: Exact action name (e.g. user.role.set)
 *       - in: query
 *         name: actorId
 *         schema: { type: string }
 *       - in: query
 *         name: targetType
 *         schema: { type: string }
 *         description: e.g. user, car, advert, settings
 *       - in: query
 *         name: targetId
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: page
 *         schema: { type: number, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: number, default: 25 }
 *     responses:
 *       '200':
 *         description: Paginated audit log entries
 */
router.get('/', auth, requireRole('admin', 'super_admin'), listAudit);

module.exports = router;
