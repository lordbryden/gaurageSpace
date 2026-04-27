const User = require("../models/user.model");
const Car = require("../models/car.model");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Canonical shape returned by login/register. Explicitly falls back to null
// for the optional image fields so clients always receive every key — even
// for older docs saved before the fields existed — rather than having to
// check for missing properties. Cars and wishlist are intentionally excluded
// so clients fetch them via their dedicated endpoints.
const buildUserResponse = (user) => ({
    id: user._id,
    name: user.name,
    phone: user.phone,
    image: user.image == null ? null : user.image,
    idCardFront: user.idCardFront == null ? null : user.idCardFront,
    idCardBack: user.idCardBack == null ? null : user.idCardBack,
    verified: user.verified || 'unverified',
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});


exports.registerUser = async(req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, phone, password, repeatPassword } = req.body;

    if (password !== repeatPassword) {
        return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    try {
        const existingUser = await User.findOne({ phone });
        if (existingUser) {
            return res.status(400).json({ success: false, message: "Phone already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({ name, phone, password: hashedPassword });

        // Auto-login: mint the same kind of non-expiring token login does and
        // persist it as the user's activeToken so later logins/logouts can
        // invalidate the session the same way.
        const token = jwt.sign({ id: newUser._id, phone: newUser.phone }, process.env.JWT_SECRET);
        newUser.activeToken = token;
        await newUser.save();

        res.status(201).json({
            success: true,
            message: "Registered successfully",
            token,
            user: buildUserResponse(newUser)
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET all users
exports.getAllUsers = async(req, res) => {
    try {
        const users = await User.find({}, "-password"); // exclude password
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/users/search — search by name (partial, case-insensitive) or id.
// Returns a paginated list of users with their cars populated, so the UI can
// show matching people and preview their cars in one round trip.
exports.searchUsers = async(req, res) => {
    try {
        const { id, name, q, page = 1, limit = 10 } = req.query;
        const term = name || q;

        const query = {};

        if (id) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ success: false, message: "Invalid user id" });
            }
            query._id = id;
        } else if (term) {
            query.name = { $regex: escapeRegex(term), $options: "i" };
        } else {
            return res.status(400).json({ success: false, message: "Provide 'name' or 'id' to search" });
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Number(limit));

        const [users, total] = await Promise.all([
            User.find(query, "-password -activeToken")
            .populate("cars")
            .sort({ name: 1, createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum),
            User.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET single user by id
exports.getUserById = async(req, res) => {
    try {
        const user = await User.findById(req.params.id, "-password");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// UPDATE user
exports.updateUser = async(req, res) => {
    try {
        const { name, phone, password, repeatPassword } = req.body;

        const updateData = {};
        if (name) updateData.name = name;
        if (phone) updateData.phone = phone;
        if (password) {
            if (password !== repeatPassword) {
                return res.status(400).json({ success: false, message: "Passwords do not match" });
            }
            updateData.password = await bcrypt.hash(password, 10);
        }

        const updatedUser = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true }).select("-password");
        if (!updatedUser) return res.status(404).json({ success: false, message: "User not found" });

        res.status(200).json({ success: true, data: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// LOGIN user
exports.loginUser = async(req, res) => {
    try {
        const { phone, password } = req.body;

        // Check if fields exist
        if (!phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Phone and password are required"
            });
        }

        // Find user
        const user = await User.findOne({ phone });
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: "Invalid credentials"
            });
        }

        // Create non-expiring token. Persisting it on the user ensures only the
        // most recent login is valid — any previous session (another device) is
        // invalidated, and logout clears it entirely.
        const token = jwt.sign({ id: user._id, phone: user.phone },
            process.env.JWT_SECRET
        );

        user.activeToken = token;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: buildUserResponse(user)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// RESET password — OTP is verified on the frontend, so here we only accept
// the new password and update it. Clearing activeToken logs out any device
// that was still signed in with the old credentials.
exports.resetPassword = async(req, res) => {
    try {
        const { phone, password, repeatPassword } = req.body;

        if (!phone || !password || !repeatPassword) {
            return res.status(400).json({ success: false, message: "phone, password and repeatPassword are required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
        }
        if (password !== repeatPassword) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        const user = await User.findOne({ phone });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.password = await bcrypt.hash(password, 10);
        user.activeToken = null;
        await user.save();

        res.status(200).json({ success: true, message: "Password reset successfully. Please log in again." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PUT /api/users/me/details — upload or replace the authenticated user's
// profile image / ID card images. Only the fields included in the multipart
// request are updated; the rest are left untouched. Scoped to req.user so a
// caller can never modify someone else's documents.
exports.updateMyDetails = async(req, res) => {
    try {
        const update = {};

        if (req.files && req.files.idCardFront && req.files.idCardFront[0]) {
            update.idCardFront = `/users/${req.files.idCardFront[0].filename}`;
        }
        if (req.files && req.files.idCardBack && req.files.idCardBack[0]) {
            update.idCardBack = `/users/${req.files.idCardBack[0].filename}`;
        }
        if (req.files && req.files.image && req.files.image[0]) {
            update.image = `/users/${req.files.image[0].filename}`;
        }

        if (Object.keys(update).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Provide at least one of: idCardFront, idCardBack, image"
            });
        }

        const updated = await User.findByIdAndUpdate(
            req.user._id,
            update, { new: true, runValidators: true }
        ).select("-password -activeToken");

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/users/wishlist — current user's wishlist with cars populated
exports.getWishlist = async(req, res) => {
    try {
        const user = await User.findById(req.user._id, "wishlist")
            .populate({
                path: "wishlist",
                populate: { path: "owner", select: "name phone" }
            });
        res.status(200).json({ success: true, data: user ? user.wishlist : [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/users/wishlist/:carId — idempotent via $addToSet
exports.addToWishlist = async(req, res) => {
    try {
        const { carId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({ success: false, message: "Invalid car id" });
        }

        const carExists = await Car.exists({ _id: carId });
        if (!carExists) return res.status(404).json({ success: false, message: "Car not found" });

        const updated = await User.findByIdAndUpdate(
            req.user._id, { $addToSet: { wishlist: carId } }, { new: true, select: "wishlist" }
        ).populate({
            path: "wishlist",
            populate: { path: "owner", select: "name phone" }
        });

        res.status(200).json({ success: true, message: "Added to wishlist", data: updated.wishlist });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/users/wishlist/:carId — idempotent via $pull
exports.removeFromWishlist = async(req, res) => {
    try {
        const { carId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(carId)) {
            return res.status(400).json({ success: false, message: "Invalid car id" });
        }

        const updated = await User.findByIdAndUpdate(
            req.user._id, { $pull: { wishlist: carId } }, { new: true, select: "wishlist" }
        ).populate({
            path: "wishlist",
            populate: { path: "owner", select: "name phone" }
        });

        res.status(200).json({ success: true, message: "Removed from wishlist", data: updated.wishlist });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// LOGOUT user — clears the active token so it can no longer be used
exports.logoutUser = async(req, res) => {
    try {
        req.user.activeToken = null;
        await req.user.save();
        res.status(200).json({ success: true, message: "Logged out" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE user
exports.deleteUser = async(req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) return res.status(404).json({ success: false, message: "User not found" });

        res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};