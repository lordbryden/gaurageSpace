const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    parkCar,
    collectCar,
    buyCar,
    sellCar,
    rentCar,
    listForRent
} = require('../controllers/car.controller');

/**
 * @swagger
 * tags:
 *   name: Cars
 *   description: Car garage and marketplace endpoints
 */

// 1. Keep car in garage
/**
 * @swagger
 * /api/cars/park:
 *   post:
 *     summary: Park/keep car in garage
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               make: { type: string }
 *               model: { type: string }
 *               year: { type: number }
 *               vin: { type: string }
 *               description: { type: string }
 *               price: { type: number }
 *     responses:
 *       201:
 *         description: Car parked
 */
router.post('/park', auth, parkCar);

// 2. Collect car
/**
 * @swagger
 * /api/cars/collect/{id}:
 *   post:
 *     summary: Collect car from garage
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Car collected
 */
router.post('/collect/:id', auth, collectCar);

// 3. Buy car
/**
 * @swagger
 * /api/cars/buy/{id}:
 *   post:
 *     summary: Buy available car for sale
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Car bought
 */
router.post('/buy/:id', auth, buyCar);

// 4. Sell car
/**
 * @swagger
 * /api/cars/sell:
 *   post:
 *     summary: Put owned car for sale
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               carId: { type: string }
 *               price: { type: number }
 *     responses:
 *       200:
 *         description: Car listed for sale
 */
router.post('/sell', auth, sellCar);

// 5. Rent car
/**
 * @swagger
 * /api/cars/rent/{id}:
 *   post:
 *     summary: Rent available car for rent
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Car rented
 */
router.post('/rent/:id', auth, rentCar);

// 6. List for rent
/**
 * @swagger
 * /api/cars/rent-list/{id}:
 *   post:
 *     summary: List owned car for rent
 *     tags: [Cars]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rentalPrice: { type: number }
 *     responses:
 *       200:
 *         description: Car listed for rent
 */
router.post('/rent-list/:id', auth, listForRent);

module.exports = router;