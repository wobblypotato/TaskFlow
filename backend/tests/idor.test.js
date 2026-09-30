const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Task = require('../src/models/Task');
const Workspace = require('../src/models/Workspace');
const WorkspaceMember = require('../src/models/WorkspaceMember');

describe('Task Cross-Workspace IDOR Isolation Integration Tests', () => {
  let userAToken;
  let userBToken;
  let userAId;
  let userBId;
  let taskBId;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }

    if (mongoose.connection.readyState !== 1) {
      console.warn('Skipping IDOR integration test: MongoDB not connected');
      return;
    }

    const timestamp = Date.now();
    const emailA = `test_user_a_${timestamp}@example.com`;
    const emailB = `test_user_b_${timestamp}@example.com`;
    const password = 'Password123!';

    // Register User A (Workspace A)
    const resA = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User Workspace A', email: emailA, password });
    expect(resA.status).toBe(201);
    userAToken = resA.body.data.token;
    userAId = resA.body.data.user._id;

    // Register User B (Workspace B)
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ name: 'User Workspace B', email: emailB, password });
    expect(resB.status).toBe(201);
    userBToken = resB.body.data.token;
    userBId = resB.body.data.user._id;

    // User B creates a task in Workspace B
    const taskRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${userBToken}`)
      .send({
        title: 'Confidential Task in Workspace B',
        description: 'Sensitive Workspace B info',
        status: 'todo',
        priority: 'high'
      });
    expect(taskRes.status).toBe(201);
    taskBId = taskRes.body.data._id;
  }, 30000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      // Clean up test users, tasks, and memberships
      if (taskBId) await Task.findByIdAndDelete(taskBId);
      if (userAId) {
        await User.findByIdAndDelete(userAId);
        await WorkspaceMember.deleteMany({ userId: userAId });
        await Workspace.deleteMany({ ownerId: userAId });
      }
      if (userBId) {
        await User.findByIdAndDelete(userBId);
        await WorkspaceMember.deleteMany({ userId: userBId });
        await Workspace.deleteMany({ ownerId: userBId });
      }
      await mongoose.connection.close();
    }
  });

  test('User B can access their own task (200 OK)', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const res = await request(app)
      .get(`/api/tasks/${taskBId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data._id).toBe(taskBId);
  });

  test('User A gets 404 on GET /api/tasks/:id for task owned by Workspace B', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const res = await request(app)
      .get(`/api/tasks/${taskBId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  test('User A gets 404 on PATCH /api/tasks/:id for task owned by Workspace B', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const res = await request(app)
      .patch(`/api/tasks/${taskBId}`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ title: 'Tampered Title by User A' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  test('User A gets 404 on DELETE /api/tasks/:id for task owned by Workspace B', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const res = await request(app)
      .delete(`/api/tasks/${taskBId}`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  test('User A gets 404 on POST /api/tasks/:id/comments for task owned by Workspace B', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const res = await request(app)
      .post(`/api/tasks/${taskBId}/comments`)
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ content: 'Unauthorized comment attempt' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });

  test('User A gets 404 on GET /api/tasks/:id/comments for task owned by Workspace B', async () => {
    if (mongoose.connection.readyState !== 1) return;

    const res = await request(app)
      .get(`/api/tasks/${taskBId}/comments`)
      .set('Authorization', `Bearer ${userAToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TASK_NOT_FOUND');
  });
});
