const AuditLog = require('../models/auditLog.model');

// Fire-and-forget audit recorder. Errors are caught and warned so a failure
// to log never breaks the actual privileged action that triggered it.
// Call AFTER the action has succeeded.
exports.logAudit = async({ actor, action, target = {}, meta = {} }) => {
    try {
        await AuditLog.create({
            actor: actor ? {
                id: actor._id,
                phone: actor.phone,
                role: actor.role,
                name: actor.name,
            } : undefined,
            action,
            target,
            meta,
        });
    } catch (err) {
        console.warn(`[audit] failed to log "${action}": ${err.message}`);
    }
};
