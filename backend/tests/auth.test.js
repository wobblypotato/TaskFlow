const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Workspace = require('../src/models/Workspace');
const WorkspaceMember = require('../src/models/WorkspaceMember');

describe('Auth & Validation Integration Tests', () => {
  let createdUserId;
  let refreshTokenCookie;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
  }, 20000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      if (createdUserId) {
        await User.findByIdAndDelete(createdUserId);
        await WorkspaceMember.deleteMany({ userId: createdUserId });
        await Workspace.deleteMany({ ownerId: createdUserId });
      }
      await mongoose.connection.close();
    }
  });

  test('Rejects invalid registration with 400 VALIDATION_ERROR via Zod', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'notanemail', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('Registers user and sets httpOnly refreshToken cookie', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const timestamp = Date.now();
    const email = `refreshtest_${timestamp}@example.com`;

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Refresh Test User', email, password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    createdUserId = res.body.data.user._id;

    // Check httpOnly refreshToken cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookieHeader = cookies.find((c) => c.startsWith('refreshToken='));
    expect(refreshCookieHeader).toBeDefined();
    expect(refreshCookieHeader).toContain('HttpOnly');
    refreshTokenCookie = refreshCookieHeader.split(';')[0];
  });

  test('POST /api/auth/refresh returns new access token with httpOnly cookie', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshTokenCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
  });

  test('POST /api/auth/refresh rejects when no cookie is provided', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const res = await request(app)
      .post('/api/auth/refresh');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/logout clears refreshToken cookie', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', refreshTokenCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cleared = cookies.find((c) => c.startsWith('refreshToken=;'));
    expect(cleared).toBeDefined();
  });
});
