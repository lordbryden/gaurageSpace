const mongoose = require('mongoose');
const Rating = require('../models/rating.model');
const User = require('../models/user.model');

// POST /api/ratings/:sellerId — rate (or update an existing rating).
// Upsert behavior: a rater calling this twice updates their stars instead of
// creating duplicates. Self-rating is rejected.
exports.rateSeller = async(req, res) => {
    try {
        const { sellerId } = req.params;
        const { stars, comment, car } = req.body;

        if (!mongoose.Types.ObjectId.isValid(sellerId)) {
            return res.status(400).json({ success: false, message: 'Invalid seller id' });
        }
        if (sellerId === String(req.user._id)) {
            return res.status(400).json({ success: false, message: 'You cannot rate yourself' });
        }

        const numStars = Number(stars);
        if (!Number.isFinite(numStars) || numStars < 1 || numStars > 5) {
            return res.status(400).json({ success: false, message: 'stars must be a number between 1 and 5' });
        }

        const seller = await User.exists({ _id: sellerId });
        if (!seller) return res.status(404).json({ success: false, message: 'Seller not found' });

        const update = {
            stars: Math.round(numStars),
            comment: comment ? String(comment) : null,
            car: car && mongoose.Types.ObjectId.isValid(car) ? car : null,
        };

        const rating = await Rating.findOneAndUpdate({ seller: sellerId, rater: req.user._id }, { $set: update, $setOnInsert: { seller: sellerId, rater: req.user._id } }, { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({ success: true, data: rating });
    } catch (error) {
        // Duplicate key on rare race condition between two upserts — surface
        // cleanly rather than 500ing.
        if (error.code === 11000) {
            return res.status(409).json({ success: false, message: 'Rating already exists for this seller' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/ratings/:sellerId/summary — { average, count, breakdown }
// Single aggregation pass; returns 0/0/empty breakdown for sellers with no
// ratings rather than a 404, so the frontend can always render the widget.
exports.getSellerSummary = async(req, res) => {
    try {
        const { sellerId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(sellerId)) {
            return res.status(400).json({ success: false, message: 'Invalid seller id' });
        }

        const objId = new mongoose.Types.ObjectId(sellerId);

        const [stats] = await Rating.aggregate([
            { $match: { seller: objId } },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    average: { $avg: '$stars' },
                },
            },
        ]);

        const breakdownRows = await Rating.aggregate([
            { $match: { seller: objId } },
            { $group: { _id: '$stars', count: { $sum: 1 } } },
        ]);

        const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        for (const row of breakdownRows) breakdown[row._id] = row.count;

        res.status(200).json({
            success: true,
            data: {
                average: stats ? Math.round(stats.average * 10) / 10 : 0,
                count: stats ? stats.count : 0,
                breakdown,
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/ratings/:sellerId — paginated list of ratings for a seller
exports.listSellerRatings = async(req, res) => {
    try {
        const { sellerId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(sellerId)) {
            return res.status(400).json({ success: false, message: 'Invalid seller id' });
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Number(limit));

        const [ratings, total] = await Promise.all([
            Rating.find({ seller: sellerId })
            .populate('rater', 'name image')
            .populate('car', 'make model year images')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum),
            Rating.countDocuments({ seller: sellerId }),
        ]);

        res.status(200).json({
            success: true,
            data: ratings,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/ratings/:sellerId/me — the caller's own rating of a given seller
// (or null). Useful for showing "you rated this seller 4 stars" in the UI.
exports.getMyRating = async(req, res) => {
    try {
        const { sellerId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(sellerId)) {
            return res.status(400).json({ success: false, message: 'Invalid seller id' });
        }

        const rating = await Rating.findOne({ seller: sellerId, rater: req.user._id });
        res.status(200).json({ success: true, data: rating || null });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /api/ratings/:sellerId — remove the caller's rating of a seller
exports.deleteMyRating = async(req, res) => {
    try {
        const { sellerId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(sellerId)) {
            return res.status(400).json({ success: false, message: 'Invalid seller id' });
        }

        const removed = await Rating.findOneAndDelete({ seller: sellerId, rater: req.user._id });
        if (!removed) return res.status(404).json({ success: false, message: 'No rating to remove' });

        res.status(200).json({ success: true, message: 'Rating removed' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
