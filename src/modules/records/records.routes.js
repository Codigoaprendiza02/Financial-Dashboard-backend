const express = require('express');
const { getRecords, createRecord, getRecordById, updateRecord, deleteRecord } = require('./record.controller');
const authMiddleware = require('../../middleware/auth.middleware');
const { requireAuth, requireRole } = require('../../middleware/role.middleware');

const router = express.Router();

router.use(authMiddleware);

router.route('/')
    .get(getRecords) // ANY AUTHENTICATED USER
    .post(requireRole('ADMIN'), createRecord); // ADMIN ONLY

router.route('/:id')
    .get(getRecordById) // ANY AUTHENTICATED USER
    .patch(requireRole('ADMIN'), updateRecord) // ADMIN ONLY
    .delete(requireRole('ADMIN'), deleteRecord); // ADMIN ONLY

module.exports = router;
