const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const auth = async(req, res, next) => {
    try {
        const authHeader = req.header('Authorization');
        const token = authHeader ? authHeader.replace('Bearer ', '') : null;
        if (!token) {
            return res.status(401).json({ success: false, message: 'No token, authorization denied' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(401).json({ success: false, message: 'Token invalid' });
        }

        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: 'Token invalid' });
    }
};

module.exports = auth;