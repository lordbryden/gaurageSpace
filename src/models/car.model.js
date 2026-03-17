const mongoose = require('mongoose');

const carSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    make: {
        type: String,
        required: true
    },
    model: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true,
        min: 1886
    },
    vin: {
        type: String,
        unique: true,
        sparse: true
    },
    description: {
        type: String,
        maxlength: 1000
    },
    price: {
        type: Number,
        min: 0
    },
    rentalPrice: {
        type: Number,
        min: 0
    },
    status: {
        type: String,
        enum: ['parked', 'available', 'rented', 'sold'],
        default: 'available'
    },
    forSale: {
        type: Boolean,
        default: false
    },
    forRent: {
        type: Boolean,
        default: false
    },
    inGarage: {
        type: Boolean,
        default: false
    },
    images: [{
        type: String
    }]
}, { timestamps: true });

module.exports = mongoose.model('Car', carSchema);