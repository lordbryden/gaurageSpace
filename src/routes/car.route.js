const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const upload = require('../middleware/multer');

// All file fields the create/update endpoints can receive.
const carFiles = upload.fields([
    { name: 'images', maxCount: 5 },
    { name: 'carteGrise', maxCount: 1 },
    { name: 'customerDocument', maxCount: 1 },
    { name: 'salesCertificate', maxCount: 1 },
    { name: 'idCardFront', maxCount: 1 },
    { name: 'idCardBack', maxCount: 1 },
]);
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
    getAvailableCars,
    getUserSaleCars,
    getUserRentCars,
    searchCars
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
 *    summary: Create new car (for sale/rent/normal) with images, docs and specs
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
 *              make: { type: string }
 *              model: { type: string }
 *              year: { type: number }
 *              vin: { type: string }
 *              description: { type: string }
 *              price: { type: number }
 *              rentalPrice: { type: number }
 *              status:
 *                type: string
 *                enum: [available, parked, rented, sold]
 *              forSale: { type: boolean }
 *              forRent: { type: boolean }
 *              inGarage: { type: boolean }
 *              fuelType:
 *                type: string
 *                enum: [petrol, diesel, electric, hybrid, lpg, cng, other]
 *              transmission:
 *                type: string
 *                enum: [manual, automatic]
 *              color: { type: string }
 *              bodyType: { type: string }
 *              mileage: { type: number }
 *              images:
 *                type: array
 *                items: { type: string, format: binary }
 *              carteGrise:
 *                type: string
 *                format: binary
 *                description: Vehicle registration document (image or PDF)
 *              customerDocument:
 *                type: string
 *                format: binary
 *                description: Customer document (image or PDF)
 *              salesCertificate:
 *                type: string
 *                format: binary
 *                description: Sales certificate (image or PDF)
 *              idCardFront:
 *                type: string
 *                format: binary
 *                description: Owner ID card front. Falls back to the user's profile if omitted.
 *              idCardBack:
 *                type: string
 *                format: binary
 *                description: Owner ID card back. Falls back to the user's profile if omitted.
 *    responses:
 *      '201':
 *        description: Car created
 */
router.post('/', carFiles, auth, createCar);

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
 *    summary: Update owned car (multipart — new images appended, new docs replace old)
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
 *        'multipart/form-data':
 *          schema:
 *            type: object
 *            properties:
 *              make: { type: string }
 *              model: { type: string }
 *              year: { type: number }
 *              description: { type: string }
 *              price: { type: number }
 *              rentalPrice: { type: number }
 *              fuelType: { type: string, enum: [petrol, diesel, electric, hybrid, lpg, cng, other] }
 *              transmission: { type: string, enum: [manual, automatic] }
 *              color: { type: string }
 *              bodyType: { type: string }
 *              mileage: { type: number }
 *              images:
 *                type: array
 *                items: { type: string, format: binary }
 *              carteGrise: { type: string, format: binary }
 *              customerDocument: { type: string, format: binary }
 *              salesCertificate: { type: string, format: binary }
 *              idCardFront: { type: string, format: binary }
 *              idCardBack: { type: string, format: binary }
 *    responses:
 *      '200':
 *        description: Car updated
 */
router.put('/:id', carFiles, auth, updateCar);

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
 * /api/cars/user/{userId}/sale:
 *  get:
 *    summary: List user's cars for sale (supports filtering)
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: userId
 *        required: true
 *        schema:
 *          type: string
 *      - in: query
 *        name: make
 *        schema: { type: string }
 *        description: Case-insensitive partial match (e.g. "bmw" matches "BMW")
 *      - in: query
 *        name: model
 *        schema: { type: string }
 *      - in: query
 *        name: year
 *        schema: { type: number }
 *      - in: query
 *        name: yearMin
 *        schema: { type: number }
 *      - in: query
 *        name: yearMax
 *        schema: { type: number }
 *      - in: query
 *        name: priceMin
 *        schema: { type: number }
 *      - in: query
 *        name: priceMax
 *        schema: { type: number }
 *      - in: query
 *        name: q
 *        schema: { type: string }
 *        description: Free-text search across make, model, description
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
 *        description: User's sale cars
 */
router.get('/user/:userId/sale', auth, getUserSaleCars);

/**
 * @swagger
 * /api/cars/user/{userId}/rent:
 *  get:
 *    summary: List user's cars for rent (supports filtering)
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: userId
 *        required: true
 *        schema:
 *          type: string
 *      - in: query
 *        name: make
 *        schema: { type: string }
 *      - in: query
 *        name: model
 *        schema: { type: string }
 *      - in: query
 *        name: year
 *        schema: { type: number }
 *      - in: query
 *        name: yearMin
 *        schema: { type: number }
 *      - in: query
 *        name: yearMax
 *        schema: { type: number }
 *      - in: query
 *        name: priceMin
 *        schema: { type: number }
 *      - in: query
 *        name: priceMax
 *        schema: { type: number }
 *      - in: query
 *        name: q
 *        schema: { type: string }
 *        description: Free-text search across make, model, description
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
 *        description: User's rent cars
 */
router.get('/user/:userId/rent', auth, getUserRentCars);

/**
 * @swagger
 * /api/cars/available:
 *  get:
 *    summary: List available cars (for sale/rent) with filtering
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
 *        name: make
 *        schema: { type: string }
 *        description: Case-insensitive partial match (e.g. "bmw" matches "BMW")
 *      - in: query
 *        name: model
 *        schema: { type: string }
 *      - in: query
 *        name: year
 *        schema: { type: number }
 *      - in: query
 *        name: yearMin
 *        schema: { type: number }
 *      - in: query
 *        name: yearMax
 *        schema: { type: number }
 *      - in: query
 *        name: priceMin
 *        schema: { type: number }
 *      - in: query
 *        name: priceMax
 *        schema: { type: number }
 *      - in: query
 *        name: q
 *        schema: { type: string }
 *        description: Free-text search across make, model, description
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
router.get('/available', getAvailableCars);

/**
 * @swagger
 * /api/cars/search:
 *  get:
 *    summary: Search cars (text + faceted filters, returns facet counts for dropdown UIs)
 *    description: >
 *      Returns matching cars plus a `facets` object listing distinct makes, models and years
 *      present in the result set. Use `q` for free-text search (e.g. "toyota"), and
 *      `make`/`model` (comma-separated for multi-select) for dropdown-driven narrowing.
 *    tags: [Cars]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: query
 *        name: q
 *        schema: { type: string }
 *        description: Free-text — matches make, model or description (case-insensitive partial)
 *      - in: query
 *        name: make
 *        schema: { type: string }
 *        description: Exact make(s). Comma-separate for multi-select, e.g. "Toyota,Honda"
 *      - in: query
 *        name: model
 *        schema: { type: string }
 *        description: Exact model(s). Comma-separated supported.
 *      - in: query
 *        name: status
 *        schema: { type: string }
 *        description: Comma-separated list, e.g. "available,rented"
 *      - in: query
 *        name: forSale
 *        schema: { type: boolean }
 *      - in: query
 *        name: forRent
 *        schema: { type: boolean }
 *      - in: query
 *        name: yearMin
 *        schema: { type: number }
 *      - in: query
 *        name: yearMax
 *        schema: { type: number }
 *      - in: query
 *        name: priceMin
 *        schema: { type: number }
 *      - in: query
 *        name: priceMax
 *        schema: { type: number }
 *      - in: query
 *        name: sort
 *        schema:
 *          type: string
 *          enum: [recent, priceAsc, priceDesc, yearAsc, yearDesc]
 *          default: recent
 *      - in: query
 *        name: page
 *        schema: { type: number, default: 1 }
 *      - in: query
 *        name: limit
 *        schema: { type: number, default: 20 }
 *    responses:
 *      '200':
 *        description: |
 *          Shape: { success, data: Car[], facets: { makes: [{make, count}], models: [{make, model, count}], years: [{year, count}] }, pagination }
 */
router.get('/search', searchCars);

module.exports = router;