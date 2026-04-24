const mongoose = require('mongoose');

const advertSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Optional link to an existing car. Adverts can also be standalone for
    // cars that are not (yet) in the cars collection — in that case the
    // standalone fields below describe the vehicle.
    car: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Car',
        default: null
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        maxlength: 2000
    },
    make: { type: String },
    model: { type: String },
    year: { type: Number, min: 1886 },
    price: { type: Number, min: 0 },
    contactPhone: { type: String },
    images: [{ type: String }],

    // Priority boost: an advert is "featured" only while priority > 0 AND
    // priorityUntil is in the future. After priorityUntil passes, the boost
    // expires automatically — no cleanup job needed.
    priority: {
        type: Number,
        default: 0,
        min: 0
    },
    priorityUntil: {
        type: Date,
        default: null
    },

    startsAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },

    status: {
        type: String,
        enum: ['draft', 'active', 'paused', 'expired'],
        default: 'active'
    },

    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
}, { timestamps: true });

advertSchema.index({ priority: -1, priorityUntil: -1 });
advertSchema.index({ status: 1, expiresAt: 1 });
advertSchema.index({ owner: 1, createdAt: -1 });

module.exports = mongoose.model('Advert', advertSchema);
