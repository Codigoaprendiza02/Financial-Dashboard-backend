function errorHandler(err, req, res, next) {

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const details = Object.keys(err.errors).map((field) => ({
      field,
      issue: err.errors[field].message
    }));
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details
      }
    });
  }

  // Mongoose Duplicate Key Error (MongoDB code 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: `Duplicate value for field: ${field}`,
        details: [{ field, issue: 'Value already exists and must be unique' }]
      }
    });
  }

  // Mongoose CastError (e.g. invalid ObjectId) handled generally, though 
  // ideally caught in specific param validators later.
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `Invalid format for field: ${err.path}`,
        details: [{ field: err.path, issue: 'Invalid value format' }]
      }
    });
  }

  // Default to 500 Internal Error
  console.error('Server Error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred in the server'
    }
  });
}

module.exports = errorHandler;
