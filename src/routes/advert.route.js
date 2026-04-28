const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const upload = require('../middleware/multerAdvert');
const {
    createAdvert,
    listAdverts,
    getFeaturedAdverts,
    getUserAdverts,
    getAdvert,
    updateAdvert,
    deleteAdvert,
    deleteAllAdverts,
    setPriority,
    trackClick
} = require('../controllers/advert.controller');

/**
 * @swagger
 * tags:
 *  name: Adverts
 *  description: Advertise cars (linked to existing cars or standalone)
 */

/**
 * @swagger
 * /api/adverts:
 *  post:
 *    summary: Create an advert (linked to a car or standalone)
 *    tags: [Adverts]
 *    security:
 *      - bearerAuth: []
 *    requestBody:
 *      required: true
 *      content:
 *        'multipart/form-data':
 *          schema:
 *            type: object
 *            required: [title]
 *            properties:
 *              title: { type: string }
 *              description: { type: string }
 *              car: { type: string, description: "Optional: link to an existing car the user owns" }
 *              make: { type: string }
 *              model: { type: string }
 *              year: { type: number }
 *              price: { type: number }
 *              contactPhone: { type: string }
 *              priority: { type: number, description: "Higher = displayed first while priorityUntil is in the future" }
 *              priorityUntil: { type: string, format: date-time }
 *              startsAt: { type: string, format: date-time }
 *              expiresAt: { type: string, format: date-time }
 *              status: { type: string, enum: [draft, active, paused, expired] }
 *              images:
 *                type: array
 *                items: { type: string, format: binary }
 *    responses:
 *      '201':
 *        description: Advert created
 */
router.post('/', upload.array('images', 5), auth, createAdvert);

/**
 * @swagger
 * /api/adverts:
 *  get:
 *    summary: List adverts (sorted by effective priority, then recency)
 *    tags: [Adverts]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: query
 *        name: status
 *        schema: { type: string, default: active }
 *      - in: query
 *        name: page
 *        schema: { type: number, default: 1 }
 *      - in: query
 *        name: limit
 *        schema: { type: number, default: 10 }
 *    responses:
 *      '200':
 *        description: Adverts list
 */
router.get('/', auth, listAdverts);

/**
 * @swagger
 * /api/adverts/featured:
 *  get:
 *    summary: List adverts whose priority boost is currently active
 *    tags: [Adverts]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: query
 *        name: limit
 *        schema: { type: number, default: 5 }
 *    responses:
 *      '200':
 *        description: Featured adverts
 */
router.get('/featured', auth, getFeaturedAdverts);

/**
 * @swagger
 * /api/adverts/user/{userId}:
 *  get:
 *    summary: List a user's adverts
 *    tags: [Adverts]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: userId
 *        required: true
 *        schema: { type: string }
 *      - in: query
 *        name: page
 *        schema: { type: number, default: 1 }
 *      - in: query
 *        name: limit
 *        schema: { type: number, default: 10 }
 *    responses:
 *      '200':
 *        description: User's adverts
 */
router.get('/user/:userId', auth, getUserAdverts);

/**
 * @swagger
 * /api/adverts/{id}:
 *  get:
 *    summary: Get a single advert (also increments view count)
 *    tags: [Adverts]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema: { type: string }
 *    responses:
 *      '200':
 *        description: Advert detail
 */
router.get('/:id', auth, getAdvert);

/**
 * @swagger
 * /api/adverts/{id}:
 *  put:
 *    summary: Update an advert (owner only). New images are appended.
 *    tags: [Adverts]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema: { type: string }
 *    requestBody:
 *      content:
 *        'multipart/form-data':
 *          schema:
 *            type: object
 *            properties:
 *              title: { type: string }
 *              description: { type: string }
 *              car: { type: string }
 *              make: { type: string }
 *              model: { type: string }
 *              year: { type: number }
 *              price: { type: number }
 *              contactPhone: { type: string }
 *              priority: { type: number }
 *              priorityUntil: { type: string, format: date-time }
 *              startsAt: { type: string, format: date-time }
 *              expiresAt: { type: string, format: date-time }
 *              status: { type: string, enum: [draft, active, paused, expired] }
 *              images:
 *                type: array
 *                items: { type: string, format: binary }
 *    responses:
 *      '200':
 *        description: Advert updated
 */
router.put('/:id', upload.array('images', 5), auth, updateAdvert);

/**
 * @swagger
 * /api/adverts/all:
 *  delete:
 *    summary: Delete every advert in the system (admin / super_admin only)
 *    tags: [Adverts]
 *    security:
 *      - bearerAuth: []
 *    responses:
 *      '200':
 *        description: All adverts deleted
 *      '403':
 *        description: Insufficient permissions
 */
router.delete('/all', auth, requireRole('admin', 'super_admin'), deleteAllAdverts);

/**
 * @swagger
 * /api/adverts/{id}:
 *  delete:
 *    summary: Delete an advert (owner only)
 *    tags: [Adverts]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema: { type: string }
 *    responses:
 *      '200':
 *        description: Advert deleted
 */
router.delete('/:id', auth, deleteAdvert);

/**
 * @swagger
 * /api/adverts/{id}/priority:
 *  post:
 *    summary: Set or refresh an advert's priority boost
 *    description: Pass either priorityUntil (absolute) or durationDays (relative). Boost ends automatically.
 *    tags: [Adverts]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema: { type: string }
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              priority: { type: number, example: 10 }
 *              priorityUntil: { type: string, format: date-time }
 *              durationDays: { type: number, example: 7 }
 *    responses:
 *      '200':
 *        description: Priority updated
 */
router.post('/:id/priority', auth, setPriority);

/**
 * @swagger
 * /api/adverts/{id}/click:
 *  post:
 *    summary: Track an advert click
 *    tags: [Adverts]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema: { type: string }
 *    responses:
 *      '200':
 *        description: Click tracked
 */
router.post('/:id/click', auth, trackClick);

module.exports = router;
