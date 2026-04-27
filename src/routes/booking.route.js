const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    createBooking,
    listMyBookings,
    getMyStats,
    getBooking,
    updateBooking,
    cancelBooking,
    deleteBooking
} = require('../controllers/booking.controller');

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Rental bookings (scoped to the authenticated user)
 */

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a rental booking for a car
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [carId, startDate, endDate]
 *             properties:
 *               carId: { type: string }
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *               notes: { type: string }
 *     responses:
 *       '201':
 *         description: Booking created (car populated)
 *       '400':
 *         description: Validation error or date overlap
 *       '404':
 *         description: Car not found
 */
router.post('/', auth, createBooking);

/**
 * @swagger
 * /api/bookings:
 *   get:
 *     summary: List the authenticated user's bookings
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, completed, cancelled]
 *         description: Filter by derived status
 *       - in: query
 *         name: page
 *         schema: { type: number, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: number, default: 10 }
 *     responses:
 *       '200':
 *         description: Bookings list with car details populated
 */
router.get('/', auth, listMyBookings);

/**
 * @swagger
 * /api/bookings/stats:
 *   get:
 *     summary: Activity summary for the authenticated user
 *     description: >
 *       Returns counts per status (pending / active / completed / cancelled) plus
 *       total and total spent on completed bookings.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: |
 *           { total, pending, active, completed, cancelled, totalSpent }
 */
router.get('/stats', auth, getMyStats);

/**
 * @swagger
 * /api/bookings/{id}/cancel:
 *   post:
 *     summary: Cancel a booking (only pending or active)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       '200':
 *         description: Booking cancelled
 *       '400':
 *         description: Already cancelled or completed
 *       '404':
 *         description: Not found
 */
router.post('/:id/cancel', auth, cancelBooking);

/**
 * @swagger
 * /api/bookings/{id}:
 *   get:
 *     summary: Get a single booking (owner only)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Booking with car populated
 */
router.get('/:id', auth, getBooking);

/**
 * @swagger
 * /api/bookings/{id}:
 *   put:
 *     summary: Update a booking's dates or notes (only pending or active)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               startDate: { type: string, format: date-time }
 *               endDate: { type: string, format: date-time }
 *               notes: { type: string }
 *     responses:
 *       '200':
 *         description: Booking updated
 *       '400':
 *         description: Cancelled/completed, validation, or overlap
 */
router.put('/:id', auth, updateBooking);

/**
 * @swagger
 * /api/bookings/{id}:
 *   delete:
 *     summary: Hard-delete a booking from history
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Booking deleted
 */
router.delete('/:id', auth, deleteBooking);

module.exports = router;
