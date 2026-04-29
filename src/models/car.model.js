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
    }],

    // Documents (file paths). Can be images or PDFs — multer accepts both.
    carteGrise: { type: String, default: null },
    customerDocument: { type: String, default: null },
    salesCertificate: { type: String, default: null },
    idCardFront: { type: String, default: null },
    idCardBack: { type: String, default: null },

    // Specs
    fuelType: {
        type: String,
        enum: ['petrol', 'diesel', 'electric', 'hybrid', 'lpg', 'cng', 'other', null],
        default: null,
    },
    transmission: {
        type: String,
        enum: ['manual', 'automatic', null],
        default: null,
    },
    color: { type: String, default: null },
    bodyType: { type: String, default: null },
    mileage: { type: Number, min: 0, default: null },

    // Verification badge. Only admin / super_admin can set this — handled in
    // the controllers, not enforced at the schema level.
    verified: {
        type: String,
        enum: ['unverified', 'verified'],
        default: 'unverified',
    },
}, { timestamps: true });

module.exports = mongoose.model('Car', carSchema);