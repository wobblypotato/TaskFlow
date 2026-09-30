const mongoose = require('mongoose');
const commentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true, index: true },
  content: { type: String, required: true, trim: true, maxlength: 2000 }
}, { timestamps: true });
commentSchema.index({ taskId: 1, createdAt: 1 });
module.exports = mongoose.model('Comment', commentSchema);
