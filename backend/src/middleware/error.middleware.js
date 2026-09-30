class AppError extends Error {
  constructor(message, statusCode, code = 'ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';

  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Request body must contain valid JSON';
  }
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') message = 'An unexpected server error occurred';

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid format for field '${err.path}'`;
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    const messages = Object.values(err.errors).map((val) => val.message);
    message = messages.join(', ');
  }

  // Handle Mongoose Duplicate Key Error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    code = field === 'email' ? 'EMAIL_ALREADY_EXISTS' : 'DUPLICATE_KEY';
    message = `A record with this ${field} already exists`;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Authentication token is invalid';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Authentication token has expired. Please log in again.';
  }

  // Log 500 server errors for debugging
  if (statusCode === 500) {
    console.error(JSON.stringify({ type: 'server-error', method: req.method, path: req.path, name: err.name || 'Error', message: err.message || 'Unknown error' }));
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    }
  });
};

module.exports = {
  AppError,
  errorHandler
};
