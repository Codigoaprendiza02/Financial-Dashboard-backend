const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Missing or invalid authentication token'
                }
            });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Missing token'
                }
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid or expired token'
                }
            });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User no longer exists'
                }
            });
        }

        if (user.status === 'INACTIVE') {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'User account is inactive'
                }
            });
        }

        req.user = user;
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = authMiddleware;
