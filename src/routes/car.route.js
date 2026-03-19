const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/multer');
const {
    createCar,
    parkCar,
    collectCar,
    buyCar,
    sellCar,
    rentCar,
    listForRent,
    updateCar,
    deleteCar,
    getAvailableCars
} = require('../controllers/car.controller');

/**
 * @swagger
 * tags:
 *  name: Cars
 *  description: Car garage and marketplace endpoints
 * securityDefinitions:
 *  bearerAuth:
 *    type: http
 *    scheme: bearer
 *    bearerFormat: JWT
 */

/**
 * @swagger
 * /api/cars:
 *  post:
 *    summary: Create new car (for sale/rent/normal) with images
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    requestBody:
 *      required: true
 *      content:
 *        'multipart/form-data':
 *          schema:
 *            type: object
 *            properties:
 *              make:
 *                type: string
 *              model:
 *                type: string
 *              year:
 *                type: number
 *              vin:
 *                type: string
 *              description:
 *                type: string
 *              price:
 *                type: number
 *              rentalPrice:
 *                type: number
 *              status:
 *                type: string
 *                enum: [available, parked, rented, sold]
 *              forSale:
 *                type: boolean
 *              forRent:
 *                type: boolean
 *              inGarage:
 *                type: boolean
 *              images:
 *                type: array
 *                items:
 *                  type: string
 *                  format: binary
 *    responses:
 *      '201':
 *        description: Car created with images
 */
router.post('/', upload.array('images', 5), auth, createCar);

/**
 * @swagger
 * /api/cars/park:
 *  post:
 *    summary: Park/keep car in garage with images
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    requestBody:
 *      required: true
 *      content:
 *        'multipart/form-data':
 *          schema:
 *            type: object
 *            properties:
 *              make:
 *                type: string
 *              model:
 *                type: string
 *              year:
 *                type: number
 *              vin:
 *                type: string
 *              description:
 *                type: string
 *              price:
 *                type: number
 *              images:
 *                type: array
 *                items:
 *                  type: string
 *                  format: binary
 *    responses:
 *      '201':
 *        description: Car parked with images
 */
router.post('/park', upload.array('images', 1), auth, parkCar);

/**
 * @swagger
 * /api/cars/collect/{id}:
 *  post:
 *    summary: Collect car from garage
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *    responses:
 *      '200':
 *        description: Car collected
 */
router.post('/collect/:id', auth, collectCar);

/**
 * @swagger
 * /api/cars/buy/{id}:
 *  post:
 *    summary: Buy available car for sale
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *    responses:
 *      '200':
 *        description: Car bought
 */
router.post('/buy/:id', auth, buyCar);

/**
 * @swagger
 * /api/cars/sell/{id}:
 *  post:
 *    summary: Put owned car for sale (set price)
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *    requestBody:
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              price:
 *                type: number
 *    responses:
 *      '200':
 *        description: Car listed for sale
 */
router.post('/sell/:id', auth, sellCar);

/**
 * @swagger
 * /api/cars/rent/{id}:
 *  post:
 *    summary: Rent available car
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *    responses:
 *      '200':
 *        description: Car rented
 */
router.post('/rent/:id', auth, rentCar);

/**
 * @swagger
 * /api/cars/rent-list/{id}:
 *  post:
 *    summary: List owned car for rent
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              rentalPrice:
 *                type: number
 *    responses:
 *      '200':
 *        description: Car listed for rent
 */
router.post('/rent-list/:id', auth, listForRent);

/**
 * @swagger
 * /api/cars/{id}:
 *  put:
 *    summary: Update owned car
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *    requestBody:
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              make: { type: string }
 *              model: { type: string }
 *              # etc...
 *    responses:
 *      '200':
 *        description: Car updated
 */
router.put('/:id', auth, updateCar);

/**
 * @swagger
 * /api/cars/{id}:
 *  delete:
 *    summary: Delete owned car
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: id
 *        required: true
 *        schema:
 *          type: string
 *    responses:
 *      '200':
 *        description: Car deleted
 */
router.delete('/:id', auth, deleteCar);

/**
 * @swagger
 * /api/cars/available:
 *  get:
 *    summary: List available cars (for sale/rent)
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: query
 *        name: status
 *        schema:
 *          type: string
 *          example: available
 *      - in: query
 *        name: forSale
 *        schema:
 *          type: boolean
 *      - in: query
 *        name: forRent
 *        schema:
 *          type: boolean
 *      - in: query
 *        name: page
 *        schema:
 *          type: number
 *          default: 1
 *      - in: query
 *        name: limit
 *        schema:
 *          type: number
 *          default: 10
 *    responses:
 *      '200':
 *        description: List of available cars
 */
router.get('/available', auth, getAvailableCars);

module.exports = router;