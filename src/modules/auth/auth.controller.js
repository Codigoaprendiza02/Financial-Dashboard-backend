const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../../models/user.model');
const { formatValidationError } = require('../../utils/validation');

const emailRegex = /^\S+@\S+\.\S+$/;

const register = async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const details = [];
        if (!name) details.push({ field: 'name', issue: 'Name is required' });
        else if (name.length < 2 || name.length > 100) details.push({ field: 'name', issue: 'Name must be between 2 and 100 characters' });

        if (!email) details.push({ field: 'email', issue: 'Email is required' });
        else if (!emailRegex.test(email)) details.push({ field: 'email', issue: 'Email is invalid' });

        if (!password) details.push({ field: 'password', issue: 'Password is required' });
        else if (password.length < 8) details.push({ field: 'password', issue: 'Password must be at least 8 characters long' });

        if (details.length > 0) {
            return res.status(400).json(formatValidationError('Validation failed', details));
        }

        // Check if email exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({
                error: {
                    code: 'CONFLICT',
                    message: 'Email already exists',
                    details: [{ field: 'email', issue: 'Must be unique' }]
                }
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: 'VIEWER' // Explicitly enforce Viewer role on open register
        });

        res.status(201).json(user);
    } catch (err) {
        next(err);
    }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Email and password are required',
                    details: [
                        ...(!email ? [{ field: 'email', issue: 'Email is required' }] : []),
                        ...(!password ? [{ field: 'password', issue: 'Password is required' }] : [])
                    ]
                }
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid credentials'
                }
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Invalid credentials'
                }
            });
        }

        if (user.status === 'INACTIVE') {
            // Technically inactive is checked here too or just forbidden
            // T2.11 checks INACTIVE on protected endpoints.
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'User account is inactive'
                }
            });
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({
            token,
            user
        });
    } catch (err) {
        next(err);
    }
};

const logout = async (req, res, next) => {
    try {
        // Since we are using stateless JWT, we simply return success
        // In a real app we might blacklist the token or clear a session cookie
        res.status(200).json({ message: 'Successfully logged out' });
    } catch (err) {
        next(err);
    }
};

const me = async (req, res, next) => {
    try {
        // req.user is populated by auth middleware
        res.status(200).json(req.user);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    register,
    login,
    logout,
    me
};
