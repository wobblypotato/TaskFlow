const { AppError } = require('./error.middleware');

const validate = ({ body, query, params } = {}) => (req, res, next) => {
  try {
    if (body) {
      req.body = body.parse(req.body);
    }
    if (query) {
      req.query = query.parse(req.query);
    }
    if (params) {
      req.params = params.parse(req.params);
    }
    next();
  } catch (err) {
    const issues = Array.isArray(err.issues) ? err.issues : (Array.isArray(err.errors) ? err.errors : null);
    if (issues) {
      const first = issues[0];
      const message = first ? `${first.path?.join('.') || 'value'}: ${first.message}` : 'Validation error';
      return next(new AppError(message, 400, 'VALIDATION_ERROR'));
    }
    return next(new AppError(err.message || 'Validation error', 400, 'VALIDATION_ERROR'));
  }
};

module.exports = { validate };
