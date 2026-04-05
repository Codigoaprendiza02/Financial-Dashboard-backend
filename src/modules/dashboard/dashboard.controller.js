const FinancialRecord = require('../../models/record.model');

// Helper to validate from/to dates
const validateDates = (from, to) => {
    if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (fromDate > toDate) {
            throw { status: 400, message: 'from date must not be after to date' };
        }
    }
};

const getOverviewMatchQuery = (from, to) => {
    const query = { isDeleted: false };
    if (from || to) {
        query.date = {};
        if (from) query.date.$gte = new Date(from);
        if (to) query.date.$lte = new Date(to);
    }
    return query;
};

// GET /api/v1/dashboard/summary
const getSummary = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        validateDates(from, to);

        const matchQuery = getOverviewMatchQuery(from, to);

        const result = await FinancialRecord.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    total_income: {
                        $sum: { $cond: [{ $eq: ["$type", "INCOME"] }, "$amount", 0] }
                    },
                    total_expenses: {
                        $sum: { $cond: [{ $eq: ["$type", "EXPENSE"] }, "$amount", 0] }
                    },
                    record_count: { $sum: 1 }
                }
            }
        ]);

        if (result.length === 0) {
            return res.status(200).json({
                total_income: 0,
                total_expenses: 0,
                net_balance: 0,
                record_count: 0,
                period: from || to ? 'custom' : 'all_time'
            });
        }

        const data = result[0];
        res.status(200).json({
            total_income: data.total_income,
            total_expenses: data.total_expenses,
            net_balance: data.total_income - data.total_expenses,
            record_count: data.record_count,
            period: from || to ? 'custom' : 'all_time'
        });

    } catch (error) {
        if (error.status === 400) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: error.message,
                    details: [{ field: 'date', issue: error.message }]
                }
            });
        }
        next(error);
    }
};

// GET /api/v1/dashboard/recent
const getRecentRecords = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 10;
        
        const records = await FinancialRecord.find({ isDeleted: false })
            .sort({ date: -1 })
            .limit(limit);

        res.status(200).json({ records });
    } catch (error) {
        next(error);
    }
};

// GET /api/v1/dashboard/categories
const getCategories = async (req, res, next) => {
    try {
        const { from, to } = req.query;
        validateDates(from, to);

        const matchQuery = getOverviewMatchQuery(from, to);

        const result = await FinancialRecord.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: { type: "$type", category: "$category" },
                    total: { $sum: "$amount" },
                    count: { $sum: 1 }
                }
            }
        ]);

        const income = [];
        const expense = [];

        result.forEach(item => {
            const data = {
                category: item._id.category,
                total: item.total,
                count: item.count
            };
            if (item._id.type === 'INCOME') income.push(data);
            else expense.push(data);
        });

        res.status(200).json({ income, expense });

    } catch (error) {
        if (error.status === 400) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: error.message,
                    details: [{ field: 'date', issue: error.message }]
                }
            });
        }
        next(error);
    }
};

// JS helper to get start of weeks (ISO standard week)
function getISOWeekString(dateObj) {
    const date = new Date(dateObj.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    const weekNum = Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7) + 1;
    const year = date.getFullYear();
    const w = weekNum < 10 ? `0${weekNum}` : `${weekNum}`;
    return `${year}-W${w}`;
}

// GET /api/v1/dashboard/trends
const getTrends = async (req, res, next) => {
    try {
        const { granularity = 'monthly', from, to } = req.query;
        validateDates(from, to);

        let startDate = from ? new Date(from) : new Date();
        if (!from) {
            startDate.setMonth(startDate.getMonth() - 6);
        }
        
        let endDate = to ? new Date(to) : new Date();

        const matchQuery = getOverviewMatchQuery(startDate.toISOString(), endDate.toISOString());

        let formatOptions = {};
        if (granularity === 'weekly') {
            formatOptions = { format: "%G-W%V", date: "$date" };
        } else {
            // monthly
            formatOptions = { format: "%Y-%m", date: "$date" };
        }

        const result = await FinancialRecord.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: { $dateToString: formatOptions },
                    income: {
                        $sum: { $cond: [{ $eq: ["$type", "INCOME"] }, "$amount", 0] }
                    },
                    expense: {
                        $sum: { $cond: [{ $eq: ["$type", "EXPENSE"] }, "$amount", 0] }
                    }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        const dbData = {};
        result.forEach(r => {
            dbData[r._id] = { income: r.income, expense: r.expense, net: r.income - r.expense };
        });

        const data = [];
        let currentDate = new Date(startDate);

        if (granularity === 'monthly') {
            // Zero fill months
            currentDate.setDate(1); // avoid end of month skip over issues
            const endMonthString = endDate.toISOString().substring(0, 7);
            
            while (true) {
                const year = currentDate.getFullYear();
                const m = currentDate.getMonth() + 1;
                const period = `${year}-${m < 10 ? '0' + m : m}`;
                
                if (dbData[period]) {
                    data.push({ period, ...dbData[period] });
                } else {
                    data.push({ period, income: 0, expense: 0, net: 0 });
                }

                if (period === endMonthString) break;
                // Next month
                currentDate.setMonth(currentDate.getMonth() + 1);
            }
        } else {
            // Zero fill weeks
            const endWeekString = getISOWeekString(endDate);
            
            let tempDate = new Date(startDate);
            let currentWeekString = getISOWeekString(tempDate);
            
            // To ensure we don't infinit loop, we advance by 7 days
            while (true) {
                if (dbData[currentWeekString] && !data.find(d => d.period === currentWeekString)) {
                    data.push({ period: currentWeekString, ...dbData[currentWeekString] });
                } else if (!data.find(d => d.period === currentWeekString)) {
                    data.push({ period: currentWeekString, income: 0, expense: 0, net: 0 });
                }

                if (currentWeekString === endWeekString || tempDate > endDate) break;
                
                tempDate.setDate(tempDate.getDate() + 7);
                currentWeekString = getISOWeekString(tempDate);
            }
        }

        res.status(200).json({ granularity, data });

    } catch (error) {
        if (error.status === 400) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: error.message,
                    details: [{ field: 'date', issue: error.message }]
                }
            });
        }
        next(error);
    }
};

module.exports = {
    getSummary,
    getRecentRecords,
    getCategories,
    getTrends
};
