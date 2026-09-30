const express = require('express');
const {
  register,
  login,
  refresh,
  logout,
  getMe,
  updateMe,
  getUsers
} = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { registerSchema, loginSchema, profileUpdateSchema } = require('../schemas/auth.schema');

const router = express.Router();

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.patch('/me', protect, validate(profileUpdateSchema), updateMe);
router.get('/users', protect, getUsers);

module.exports = router;
