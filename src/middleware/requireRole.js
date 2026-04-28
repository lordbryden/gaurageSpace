// Authorization gate. Use after the auth middleware (which populates req.user).
// Pass the roles allowed to access the endpoint, e.g.:
//   router.delete('/all', auth, requireRole('admin', 'super_admin'), handler);
const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
};

module.exports = requireRole;
