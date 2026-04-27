const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    car: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Car',
        required: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    // Persisted so reports don't recompute on every read.
    days: {
        type: Number,
        required: true,
        min: 1,
    },
    // Snapshots of the car's rental price at booking time — so later price
    // changes don't retroactively alter what the user paid.
    rentalPrice: {
        type: Number,
        required: true,
        min: 0,
    },
    totalCost: {
        type: Number,
        required: true,
        min: 0,
    },
    notes: {
        type: String,
        maxlength: 500,
    },
    // Status is derived (see virtual below). Only cancellation is stored
    // explicitly, because it's the one transition the user controls.
    cancelledAt: {
        type: Date,
        default: null,
    },
    cancelReason: {
        type: String,
        maxlength: 500,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

bookingSchema.virtual('status').get(function() {
    if (this.cancelledAt) return 'cancelled';
    const now = new Date();
    if (this.endDate < now) return 'completed';
    if (this.startDate <= now) return 'active';
    return 'pending';
});

bookingSchema.index({ user: 1, startDate: -1 });
bookingSchema.index({ car: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
