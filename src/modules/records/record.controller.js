const FinancialRecord = require('../../models/record.model');
const mongoose = require('mongoose');
const { logAction } = require('../../utils/audit.service');

// GET /api/v1/records
const getRecords = async (req, res, next) => {
    try {
        const { type, category, from, to, page = 1, limit = 20, sort, order = 'desc', search } = req.query;

        let query = { isDeleted: false };

        if (type) query.type = type;
        if (category) query.category = category;

        if (from || to) {
            query.date = {};
            if (from) query.date.$gte = new Date(from);
            if (to) query.date.$lte = new Date(to);
        }

        if (search) {
            query.$or = [
                { category: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        const parsedPage = parseInt(page, 10);
        let parsedLimit = parseInt(limit, 10);
        if (parsedLimit > 100) parsedLimit = 100;
        
        const count = await FinancialRecord.countDocuments(query);
        const totalPages = Math.ceil(count / parsedLimit);
        const skip = (parsedPage - 1) * parsedLimit;

        let sortOptions = {};
        if (sort === 'date' || sort === 'amount') {
            sortOptions[sort] = order === 'asc' ? 1 : -1;
        } else {
            sortOptions['date'] = -1; // Default
        }

        const records = await FinancialRecord.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(parsedLimit);

        res.status(200).json({
            data: records,
            total: count,
            page: parsedPage,
            limit: parsedLimit,
            totalPages
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/v1/records
const createRecord = async (req, res, next) => {
    try {
        const { amount, type, category, date, notes } = req.body;

        // Enforce 2 decimal places
        const roundedAmount = Math.round(amount * 100) / 100;

        const newRecord = new FinancialRecord({
            amount: roundedAmount,
            type,
            category,
            date,
            notes,
            createdBy: req.user.id
        });

        await newRecord.save();

        // Audit Log
        if (req.user) {
            await logAction(req.user.id, 'CREATE_RECORD', 'FinancialRecord', newRecord.id);
        }

        res.status(201).json(newRecord);
    } catch (error) {
        next(error);
    }
};

// GET /api/v1/records/:id
const getRecordById = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid record ID'
                }
            });
        }

        const record = await FinancialRecord.findOne({ _id: id, isDeleted: false });

        if (!record) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Record not found'
                }
            });
        }

        res.status(200).json(record);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/v1/records/:id
const updateRecord = async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid record ID'
                }
            });
        }

        if (updates.amount) {
            updates.amount = Math.round(updates.amount * 100) / 100;
        }

        const record = await FinancialRecord.findOneAndUpdate(
            { _id: id, isDeleted: false },
            updates,
            { returnDocument: 'after', runValidators: true }
        );

        if (!record) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Record not found'
                }
            });
        }

        // Audit Log
        await logAction(req.user.id, 'UPDATE_RECORD', 'FinancialRecord', record.id);

        res.status(200).json(record);
    } catch (error) {
        next(error);
    }
};

// DELETE /api/v1/records/:id
const deleteRecord = async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid record ID'
                }
            });
        }

        const record = await FinancialRecord.findOneAndUpdate(
            { _id: id, isDeleted: false },
            { isDeleted: true },
            { returnDocument: 'after' }
        );

        if (!record) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Record not found'
                }
            });
        }

        // Audit Log
        await logAction(req.user.id, 'DELETE_RECORD', 'FinancialRecord', record.id);

        res.status(200).json({ message: 'Record deleted' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getRecords,
    createRecord,
    getRecordById,
    updateRecord,
    deleteRecord
};
