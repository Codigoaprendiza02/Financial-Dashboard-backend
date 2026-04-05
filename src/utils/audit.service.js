const AuditLog = require('../models/auditlog.model');

/**
 * Log a system action to the AuditLog collection
 * @param {string} userId - ID of the user performing the action
 * @param {string} action - Action name (e.g. 'CREATE_RECORD')
 * @param {string} targetType - Type of resource (e.g. 'FinancialRecord')
 * @param {string} targetId - ID of the impacted resource
 */
const logAction = async (userId, action, targetType, targetId) => {
    try {
        await AuditLog.create({
            userId,
            action,
            targetType,
            targetId,
            timestamp: new Date()
        });
    } catch (error) {
        // We catch but don't rethrow to avoid breaking the main request if logging fails
        console.error('Failed to create audit log:', error);
    }
};

module.exports = {
    logAction
};
