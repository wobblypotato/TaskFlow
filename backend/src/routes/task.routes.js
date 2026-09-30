const express = require('express');
const {
  createTask,
  getTasks,
  getTaskStats,
  getTaskById,
  updateTask,
  deleteTask,
  getActivity,
  getComments,
  createComment
} = require('../controllers/task.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  createTaskSchema,
  updateTaskSchema,
  taskIdParamSchema,
  getTasksSchema,
  getTaskStatsSchema,
  getActivitySchema,
  createCommentSchema
} = require('../schemas/task.schema');

const router = express.Router();

// All task routes require authentication
router.use(protect);

// Task stats endpoint (must precede /:id to prevent route shadowing)
router.get('/stats', validate(getTaskStatsSchema), getTaskStats);
router.get('/activity', validate(getActivitySchema), getActivity);
router.get('/:id/comments', validate(taskIdParamSchema), getComments);
router.post('/:id/comments', validate(createCommentSchema), createComment);

// Task collection endpoints
router.route('/')
  .post(validate(createTaskSchema), createTask)
  .get(validate(getTasksSchema), getTasks);

// Individual task endpoints
router.route('/:id')
  .get(validate(taskIdParamSchema), getTaskById)
  .patch(validate(updateTaskSchema), updateTask)
  .delete(validate(taskIdParamSchema), deleteTask);

module.exports = router;
