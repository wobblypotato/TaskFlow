const mongoose = require('mongoose');
const activitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  action: { type: String, required: true, enum: ['TASK_CREATED', 'TASK_UPDATED', 'TASK_COMPLETED', 'TASK_DELETED', 'PRIORITY_CHANGED', 'STATUS_CHANGED', 'COMMENT_ADDED'] },
  createdAt: { type: Date, default: Date.now, index: true }
});
activitySchema.index({ userId: 1, createdAt: -1 });
module.exports = mongoose.model('Activity', activitySchema);
