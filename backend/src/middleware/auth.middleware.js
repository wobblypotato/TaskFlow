const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('./error.middleware');

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('No authentication token provided. Please log in.', 401, 'UNAUTHORIZED'));
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) return next(new AppError('Authentication is not configured', 503, 'AUTH_NOT_CONFIGURED'));
    const decoded = jwt.verify(token, secret);

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401, 'USER_NOT_FOUND'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  protect
};
