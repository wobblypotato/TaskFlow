const Activity = require('../models/Activity');

const logActivity = (userId, taskId, action) => Activity.create({ userId, taskId, action }).catch((error) => {
  console.error(JSON.stringify({ type: 'activity-log-error', message: error.message }));
});

const emitTaskEvent = (io, userId, event, task) => {
  if (!io) return;
  const payload = task && task.toObject ? task.toObject() : task;
  io.to(`user:${userId}`).emit(event, payload);
  io.to('workspace').emit(event, { ...payload, originatorId: String(userId) });

  const actionText =
    event === 'task:created'
      ? 'created a new task'
      : event === 'task:deleted'
      ? 'deleted a task'
      : payload?.status === 'completed'
      ? 'completed a task'
      : 'updated a task';

  if (payload?.title) {
    io.to('workspace').emit('notification:new', {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: event,
      title: payload.title,
      message: `${actionText}: "${payload.title}"`,
      taskId: payload._id ? String(payload._id) : null,
      originatorId: String(userId),
      createdAt: new Date().toISOString()
    });
  }
};

module.exports = { logActivity, emitTaskEvent };
