const User = require('../../models/user.model');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { logAction } = require('../../utils/audit.service');

// GET /api/v1/users
const getUsers = async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        let query = {};
        
        if (status) {
            query.status = status;
        }

        const parsedPage = parseInt(page, 10);
        let parsedLimit = parseInt(limit, 10);
        if (parsedLimit > 100) parsedLimit = 100;
        
        const count = await User.countDocuments(query);
        const totalPages = Math.ceil(count / parsedLimit);
        const skip = (parsedPage - 1) * parsedLimit;

        const users = await User.find(query)
            .skip(skip)
            .limit(parsedLimit);

        res.status(200).json({
            data: users,
            total: count,
            page: parsedPage,
            limit: parsedLimit,
            totalPages
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/v1/users
const createUser = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;

        if (!password) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Password is required',
                    details: [{ field: 'password', issue: 'Password is required' }]
                }
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'VIEWER'
        });

        await newUser.save();

        // Audit Log
        if (req.user) {
            await logAction(req.user.id, 'CREATE_USER', 'User', newUser.id);
        }

        res.status(201).json(newUser);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({
                error: {
                    code: 'CONFLICT',
                    message: 'Email already in use'
                }
            });
        }
        next(error);
    }
};

// GET /api/v1/users/:id
const getUserById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid user ID'
                }
            });
        }

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/v1/users/:id
const updateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid user ID'
                }
            });
        }

        // Only allow updating name, role, status
        const allowedUpdates = {};
        if (updates.name) allowedUpdates.name = updates.name;
        if (updates.role) allowedUpdates.role = updates.role;
        if (updates.status) allowedUpdates.status = updates.status;

        const user = await User.findByIdAndUpdate(id, allowedUpdates, { returnDocument: 'after', runValidators: true });

        if (!user) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Audit Log
        await logAction(req.user.id, 'UPDATE_USER', 'User', user.id);

        res.status(200).json(user);
    } catch (error) {
        next(error);
    }
};

// DELETE /api/v1/users/:id
const deleteUser = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid user ID'
                }
            });
        }

        const user = await User.findByIdAndDelete(id);

        if (!user) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'User not found'
                }
            });
        }

        // Audit Log
        await logAction(req.user.id, 'DELETE_USER', 'User', user.id);

        res.status(204).send();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getUsers,
    createUser,
    getUserById,
    updateUser,
    deleteUser
};
