const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    rater: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    stars: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        maxlength: 1000,
        default: null,
    },
    // Optional context: which car the rater was looking at when they rated.
    // Useful for "I rated this seller from their Mustang listing", but the
    // rating itself is on the seller, not the car.
    car: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Car',
        default: null,
    },
}, { timestamps: true });

// One rating per (seller, rater) pair — enforces the "rate a seller only once"
// rule. Updating reuses the same row via upsert in the controller.
ratingSchema.index({ seller: 1, rater: 1 }, { unique: true });
ratingSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('Rating', ratingSchema);
