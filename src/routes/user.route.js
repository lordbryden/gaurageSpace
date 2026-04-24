const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const auth = require("../middleware/auth");
const uploadUser = require("../middleware/multerUser");
const {
    registerUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    loginUser,
    logoutUser,
    resetPassword,
    searchUsers,
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    updateMyDetails
} = require("../controllers/user.controller");
/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

/**
 * @swagger
 * /api/users/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *               - password
 *               - repeatPassword
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               repeatPassword:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 */
router.post(
    "/register", [
        body("name").notEmpty().withMessage("Name is required"),
        body("phone").notEmpty().withMessage("Phone is required").matches(/^\d{9,15}$/).withMessage("Phone must be 10-15 digits"),
        body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
        body("repeatPassword").notEmpty().withMessage("Repeat password is required"),
    ],
    registerUser
);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     tags: [Users]
 *     responses:
 *       200:
 *         description: List of users
 */
router.get("/", getAllUsers);

/**
 * @swagger
 * /api/users/search:
 *   get:
 *     summary: Search users by name (partial) or id (exact) — returns users with their cars populated
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: name
 *         schema: { type: string }
 *         description: Partial, case-insensitive match on user's name (e.g. "john" matches "Johnny")
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Alias for name
 *       - in: query
 *         name: id
 *         schema: { type: string }
 *         description: Exact user id. Takes precedence over name when provided.
 *       - in: query
 *         name: page
 *         schema: { type: number, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: number, default: 10 }
 *     responses:
 *       200:
 *         description: Matching users, each with populated `cars` array
 *       400:
 *         description: No search param provided, or invalid id
 */
router.get("/search", searchUsers);

/**
 * @swagger
 * /api/users/wishlist:
 *   get:
 *     summary: Get the authenticated user's wishlist (cars populated)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wishlist cars
 */
router.get("/wishlist", auth, getWishlist);

/**
 * @swagger
 * /api/users/wishlist/{carId}:
 *   post:
 *     summary: Add a car to the authenticated user's wishlist (idempotent)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: carId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated wishlist
 *       400:
 *         description: Invalid car id
 *       404:
 *         description: Car not found
 */
router.post("/wishlist/:carId", auth, addToWishlist);

/**
 * @swagger
 * /api/users/wishlist/{carId}:
 *   delete:
 *     summary: Remove a car from the authenticated user's wishlist (idempotent)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: carId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Updated wishlist
 *       400:
 *         description: Invalid car id
 */
router.delete("/wishlist/:carId", auth, removeFromWishlist);

/**
 * @swagger
 * /api/users/me/details:
 *   put:
 *     summary: Upload or replace authenticated user's profile image and ID card images
 *     description: >
 *       Send any combination of the three files. Only fields present in the request are updated;
 *       omitted fields keep their current value. All three default to null until first set.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         'multipart/form-data':
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Profile photo
 *               idCardFront:
 *                 type: string
 *                 format: binary
 *               idCardBack:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Updated user (password and activeToken omitted)
 *       400:
 *         description: No image fields were provided
 */
router.put(
    "/me/details",
    uploadUser.fields([
        { name: "idCardFront", maxCount: 1 },
        { name: "idCardBack", maxCount: 1 },
        { name: "image", maxCount: 1 }
    ]),
    auth,
    updateMyDetails
);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get a single user by ID
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *       404:
 *         description: User not found
 */
router.get("/:id", getUserById);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               repeatPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put("/:id", updateUser);


/**
 * @swagger
 * /api/users/login:
 *  post:
 *    summary: Login user (returns JWT token for car endpoints)
 *    tags: [Users]
 *    requestBody:
 *      required: true
 *      content:
 *        application/json:
 *          schema:
 *            type: object
 *            properties:
 *              phone:
 *                type: string
 *              password:
 *                type: string
 *    responses:
 *      '200':
 *        description: Login successful with token
 */
router.post("/login", loginUser);

/**
 * @swagger
 * /api/users/reset-password:
 *   post:
 *     summary: Reset a user's password (OTP is verified on the frontend)
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *               - repeatPassword
 *             properties:
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               repeatPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 */
router.post("/reset-password", resetPassword);

/**
 * @swagger
 * /api/users/logout:
 *  post:
 *    summary: Logout current user (invalidates the active token)
 *    tags: [Users]
 *    security:
 *      - bearerAuth: []
 *    responses:
 *      '200':
 *        description: Logged out
 */
router.post("/logout", auth, logoutUser);
/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 */
router.delete("/:id", deleteUser);


module.exports = router;