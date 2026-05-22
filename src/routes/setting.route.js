const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { getSettings, updateSettings } = require('../controllers/setting.controller');

/**
 * @swagger
 * tags:
 *  name: Settings
 *  description: Platform configuration (admin / super_admin only)
 */

/**
 * @swagger
 * /api/settings:
 *   get:
 *     summary: Get all platform settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Key/value map of every setting
 */
router.get('/', auth, requireRole('admin', 'super_admin'), getSettings);

/**
 * @swagger
 * /api/settings:
 *   put:
 *     summary: Upsert one or more settings
 *     description: Body is a JSON object of key/value pairs — each is upserted independently.
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             additionalProperties: true
 *             example:
 *               imageQuality: 80
 *               maxImagesPerCar: 5
 *               verificationConfidenceThreshold: 0.5
 *     responses:
 *       '200':
 *         description: Updated settings map
 *       '400':
 *         description: Empty or non-object body
 */
router.put('/', auth, requireRole('admin', 'super_admin'), updateSettings);

module.exports = router;
