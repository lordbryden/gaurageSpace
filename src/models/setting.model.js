const mongoose = require('mongoose');

// One row per setting key. Value is mixed so any JSON-serializable value
// can be stored. PUT /api/settings upserts; GET returns the whole map.
const settingSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
}, { timestamps: true });

module.exports = mongoose.model('Setting', settingSchema);
