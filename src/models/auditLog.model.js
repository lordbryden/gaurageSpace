const mongoose = require('mongoose');

// Records privileged actions taken by admins/super_admins. Written by the
// utils/auditLog helper from inside controllers — never from app middleware,
// because we want to log only after an action actually succeeded.
const auditLogSchema = new mongoose.Schema({
    actor: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        phone: { type: String },
        role: { type: String },
        name: { type: String },
    },
    // Dot-namespaced verb, e.g. "user.role.set", "car.verify", "advert.delete-all".
    action: {
        type: String,
        required: true,
        index: true,
    },
    target: {
        type: { type: String, index: true },
        id: { type: String, index: true },
        label: { type: String }, // human-readable (e.g. phone, title)
    },
    // Free-form context: previous/new value, scope, counts, etc.
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ 'actor.id': 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
