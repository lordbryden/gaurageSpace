const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
    },
    phone: {
        type: String,
        required: [true, "Phone number is required"],
        unique: true,
        match: [/^\d{9,15}$/, "Phone number must be 9-15 digits"], // simple validation
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [6, "Password must be at least 6 characters"],
    },
    cars: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Car'
    }],
    wishlist: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Car'
    }],
    activeToken: {
        type: String,
        default: null,
    },
    idCardFront: {
        type: String,
        default: null,
    },
    idCardBack: {
        type: String,
        default: null,
    },
    image: {
        type: String,
        default: null,
    },
    verified: {
        type: String,
        enum: ['unverified', 'pending', 'verified'],
        default: 'unverified',
    },
    // Authorization tier. regular is the default at registration.
    // merchant is reached automatically by creating a car or uploading personal
    // details. admin is set by a super_admin via PUT /api/users/:id/role.
    // super_admin can only be set directly in the DB.
    role: {
        type: String,
        enum: ['regular', 'merchant', 'admin', 'super_admin'],
        default: 'regular',
    },
    email: {
        type: String,
        default: null,
        trim: true,
        lowercase: true,
    },
    dateOfBirth: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);