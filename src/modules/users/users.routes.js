const express = require('express');
const { getUsers, createUser, getUserById, updateUser, deleteUser } = require('./user.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { requireRole } = require('../../middleware/role.middleware');

const router = express.Router();

// Apply auth and ADMIN role to all user routes
router.use(authMiddleware, requireRole('ADMIN'));

router.route('/')
    .get(getUsers)
    .post(createUser);

router.route('/:id')
    .get(getUserById)
    .patch(updateUser)
    .delete(deleteUser);

module.exports = router;
