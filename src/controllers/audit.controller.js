const AuditLog = require('../models/auditLog.model');

// GET /api/audit — admin / super_admin only.
// Filters: action, actorId, targetType, targetId, from/to date range.
exports.listAudit = async(req, res) => {
    try {
        const { action, actorId, targetType, targetId, from, to, page = 1, limit = 25 } = req.query;

        const query = {};
        if (action) query.action = action;
        if (actorId) query['actor.id'] = actorId;
        if (targetType) query['target.type'] = targetType;
        if (targetId) query['target.id'] = String(targetId);
        if (from || to) {
            query.createdAt = {};
            if (from) query.createdAt.$gte = new Date(from);
            if (to) query.createdAt.$lte = new Date(to);
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.max(1, Number(limit));

        const [logs, total] = await Promise.all([
            AuditLog.find(query)
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum),
            AuditLog.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: logs,
            pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
