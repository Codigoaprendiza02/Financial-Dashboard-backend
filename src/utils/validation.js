const formatValidationError = (message, details) => {
    return {
        error: {
            code: 'VALIDATION_ERROR',
            message: message,
            details: details
        }
    };
};

module.exports = {
    formatValidationError
};
