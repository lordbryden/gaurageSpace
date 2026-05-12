const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    rateSeller,
    getSellerSummary,
    listSellerRatings,
    getMyRating,
    deleteMyRating,
} = require('../controllers/rating.controller');

/**
 * @swagger
 * tags:
 *  name: Ratings
 *  description: Seller ratings (5-star). One rating per (seller, rater) pair.
 */

/**
 * @swagger
 * /api/ratings/{sellerId}/summary:
 *  get:
 *    summary: Aggregate rating for a seller — average, count, per-star breakdown
 *    tags: [Ratings]
 *    parameters:
 *      - in: path
 *        name: sellerId
 *        required: true
 *        schema: { type: string }
 *    responses:
 *      '200':
 *        description: |
 *          { average: 4.3, count: 27, breakdown: { 1: 1, 2: 0, 3: 5, 4: 10, 5: 11 } }
 */
router.get('/:sellerId/summary', getSellerSummary);

/**
 * @swagger
 * /api/ratings/{sellerId}/me:
 *  get:
 *    summary: The authenticated user's own rating of this seller (null if not rated yet)
 *    tags: [Ratings]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: sellerId
 *        required: true
 *        schema: { type: string }
 *    responses:
 *      '200':
 *        description: Rating record or null
 */
router.get('/:sellerId/me', auth, getMyRating);

/**
 * @swagger
 * /api/ratings/{sellerId}:
 *  get:
 *    summary: List ratings left for a seller (paginated, raters populated)
 *    tags: [Ratings]
 *    parameters:
 *      - in: path
 *        name: sellerId
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
 *        description: Ratings list
 */
router.get('/:sellerId', listSellerRatings);

/**
 * @swagger
 * /api/ratings/{sellerId}:
 *  post:
 *    summary: Rate a seller (1-5 stars). Idempotent — calling again updates your rating.
 *    tags: [Ratings]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: sellerId
 *        required: true
 *        schema: { type: string }
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            required: [stars]
 *            properties:
 *              stars: { type: number, minimum: 1, maximum: 5 }
 *              comment: { type: string }
 *              car: { type: string, description: "Optional car id for context" }
 *    responses:
 *      '200':
 *        description: Rating saved
 *      '400':
 *        description: Invalid input or self-rating attempt
 *      '404':
 *        description: Seller not found
 */
router.post('/:sellerId', auth, rateSeller);

/**
 * @swagger
 * /api/ratings/{sellerId}:
 *  delete:
 *    summary: Remove the caller's rating of this seller
 *    tags: [Ratings]
 *    security:
 *      - bearerAuth: []
 *    parameters:
 *      - in: path
 *        name: sellerId
 *        required: true
 *        schema: { type: string }
 *    responses:
 *      '200':
 *        description: Rating removed
 *      '404':
 *        description: No rating existed
 */
router.delete('/:sellerId', auth, deleteMyRating);

module.exports = router;
