const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const WorkspaceMember = require('../models/WorkspaceMember');
const { AppError } = require('../middleware/error.middleware');
const { ensureUserWorkspace, getUserActiveWorkspace } = require('../services/workspace.service');

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET must be configured');
  return secret;
};

const getRefreshSecret = () => {
  return process.env.JWT_REFRESH_SECRET || (getJwtSecret() + '_refresh');
};

const signAccessToken = (id) => {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN || '15m';
  return jwt.sign({ id }, secret, { expiresIn });
};

const signRefreshToken = (id, tokenVersion) => {
  const secret = getRefreshSecret();
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  return jwt.sign({ id, v: tokenVersion }, secret, { expiresIn });
};

const setRefreshTokenCookie = (res, refreshToken) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
  });
};

const issueTokens = (res, user) => {
  const accessToken = signAccessToken(user._id);
  setRefreshTokenCookie(res, signRefreshToken(user._id, user.tokenVersion));
  return accessToken;
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return next(new AppError('An account with this email already exists', 409, 'EMAIL_ALREADY_EXISTS'));
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash
    });

    await ensureUserWorkspace(user);

    const accessToken = issueTokens(res, user);

    res.status(201).json({
      success: true,
      data: {
        user,
        token: accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return next(new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS'));
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS'));
    }

    const accessToken = issueTokens(res, user);

    await ensureUserWorkspace(user);

    res.status(200).json({
      success: true,
      data: {
        user,
        token: accessToken
      }
    });
  } catch (error) {
    next(error);
  }
};

const refresh = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      return next(new AppError('Refresh token required', 401, 'REFRESH_TOKEN_REQUIRED'));
    }

    const refreshSecret = getRefreshSecret();
    let decoded;
    try {
      decoded = jwt.verify(token, refreshSecret);
    } catch (err) {
      return next(new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN'));
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('User not found', 401, 'USER_NOT_FOUND'));
    }
    if ((decoded.v || 0) !== user.tokenVersion) {
      return next(new AppError('Refresh token has been revoked', 401, 'REFRESH_TOKEN_REVOKED'));
    }

    const newAccessToken = issueTokens(res, user);

    res.status(200).json({
      success: true,
      data: {
        token: newAccessToken,
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // Derive the user from the refresh cookie itself (not an access token) so
    // logout still revokes tokens even if the access token already expired.
    // Bumping tokenVersion invalidates every refresh token issued before now,
    // not just the one in this browser's cookie.
    const token = req.cookies?.refreshToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, getRefreshSecret());
        await User.findByIdAndUpdate(decoded.id, { $inc: { tokenVersion: 1 } });
      } catch {
        // Already invalid/expired - nothing to revoke.
      }
    }

    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

const getMe = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      user: req.user
    }
  });
};

const updateMe = async (req, res, next) => {
  try {
    const { name, email, password, avatar } = req.body;

    if (email && email !== req.user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return next(new AppError('An account with this email already exists', 409, 'EMAIL_ALREADY_EXISTS'));
      }
      req.user.email = email;
    }

    if (name !== undefined) req.user.name = name;
    if (avatar !== undefined) req.user.avatar = avatar;
    if (password) {
      req.user.passwordHash = await bcrypt.hash(password, 10);
      req.user.tokenVersion += 1;
    }

    await req.user.save();
    res.status(200).json({ success: true, data: { user: req.user } });
  } catch (error) {
    next(error);
  }
};

const getUsers = async (req, res, next) => {
  try {
    const { workspace } = await getUserActiveWorkspace(req.user);
    const members = await WorkspaceMember.find({ workspaceId: workspace._id })
      .populate('userId', 'name email createdAt')
      .lean();

    const users = members
      .filter((m) => m.userId)
      .map((m) => ({
        _id: m.userId._id,
        name: m.userId.name,
        email: m.userId.email,
        role: m.role,
        joinedAt: m.joinedAt || m.createdAt,
        createdAt: m.userId.createdAt
      }));

    res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateMe,
  getUsers
};
