const Task = require('../models/Task');
const { AppError } = require('../middleware/error.middleware');
const Activity = require('../models/Activity');
const Comment = require('../models/Comment');
const WorkspaceMember = require('../models/WorkspaceMember');
const { logActivity, emitTaskEvent } = require('../services/task-events');
const { scheduleReminderJob, cancelReminderJob } = require('../queues/reminder.queue');
const { getUserActiveWorkspace, getWorkspaceMemberUserIds } = require('../services/workspace.service');

const emitForRequest = (req, userId, event, task) => emitTaskEvent(req.app.locals.io, userId, event, task);

const nextOccurrence = (task) => {
  const date = task.dueDate ? new Date(task.dueDate) : new Date();
  if (task.recurringInterval === 'daily') date.setDate(date.getDate() + 1);
  if (task.recurringInterval === 'weekly') date.setDate(date.getDate() + 7);
  if (task.recurringInterval === 'monthly') date.setMonth(date.getMonth() + 1);
  return date;
};

const normalizeTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim()).filter(Boolean);
  }
  if (typeof tags === 'string') {
    return tags.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
};

/**
 * Access control helper: verifies that user is task owner or member of task's workspace
 */
const canUserAccessTask = async (user, task) => {
  const userIdStr = String(user._id || user.id);
  const taskUserIdStr = String(task.userId?._id || task.userId);
  if (taskUserIdStr === userIdStr) return true;
  if (task.workspaceId) {
    const isMember = await WorkspaceMember.exists({
      workspaceId: task.workspaceId,
      userId: user._id || user.id
    });
    return Boolean(isMember);
  }
  return false;
};

const createTask = async (req, res, next) => {
  try {
    const { title, description, status, priority, tags, dueDate, reminderAt, recurringInterval } = req.body;

    const requestedWorkspaceId = req.headers['x-workspace-id'] || req.body?.workspaceId;
    const { workspace } = await getUserActiveWorkspace(req.user, requestedWorkspaceId);

    const task = await Task.create({
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      status: status || 'todo',
      priority: priority || 'medium',
      tags: normalizeTags(tags),
      dueDate: dueDate ? new Date(dueDate) : null,
      completedAt: (status || 'todo') === 'completed' ? new Date() : null,
      reminderAt: reminderAt ? new Date(reminderAt) : null,
      isRecurring: Boolean(recurringInterval),
      recurringInterval: recurringInterval || null,
      userId: req.user._id,
      workspaceId: workspace ? workspace._id : null
    });
    if (task.reminderAt) await scheduleReminderJob(task, task.reminderAt, req.user.email);
    logActivity(req.user._id, task._id, 'TASK_CREATED');
    emitForRequest(req, req.user._id, 'task:created', task);

    res.status(201).json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
};

const getTasks = async (req, res, next) => {
  try {
    const { search, status, priority, tag, tags, dueDate, sortBy, sortOrder, scope } = req.query;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    const requestedWorkspaceId = req.headers['x-workspace-id'] || req.query.workspaceId;
    const { workspace } = await getUserActiveWorkspace(req.user, requestedWorkspaceId);
    const memberUserIds = workspace ? await getWorkspaceMemberUserIds(workspace._id) : [req.user._id];

    // Collaborative filter criteria: scope to 'my' only if explicitly requested, otherwise workspace
    const filter = scope === 'my'
      ? { userId: req.user._id }
      : {
          $or: [
            { workspaceId: workspace ? workspace._id : null },
            { userId: { $in: memberUserIds } }
          ]
        };

    // Search by title (case-insensitive substring)
    if (search && search.trim()) {
      filter.title = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    }

    if (status) {
      filter.status = status;
    }

    if (priority) {
      filter.priority = priority;
    }

    // Filter by tag
    if (tag && tag.trim()) {
      filter.tags = tag.trim();
    }
    if (tags && tags.trim()) filter.tags = tags.trim();
    if (dueDate) {
      const start = new Date(dueDate);
      if (!Number.isNaN(start.getTime())) {
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        filter.dueDate = { $gte: start, $lt: end };
      }
    }

    // Sorting logic
    const allowedSortFields = ['createdAt', 'dueDate', 'priority', 'title'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderDirection = sortOrder === 'asc' ? 1 : -1;

    const [tasks, totalTasks] = await Promise.all([
      sortField === 'priority'
        ? Task.aggregate([
            { $match: filter },
            {
              $addFields: {
                priorityRank: {
                  $switch: {
                    branches: [
                      { case: { $eq: ['$priority', 'high'] }, then: 0 },
                      { case: { $eq: ['$priority', 'medium'] }, then: 1 }
                    ],
                    default: 2
                  }
                }
              }
            },
            { $sort: { priorityRank: orderDirection, createdAt: -1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $project: { priorityRank: 0 } },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userId'
              }
            },
            { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
            {
              $project: {
                'userId.passwordHash': 0,
                'userId.__v': 0
              }
            }
          ])
        : Task.find(filter)
            .populate('userId', 'name email')
            .sort({ [sortField]: orderDirection })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),

      Task.countDocuments(filter)
    ]);

    // Attach commentsCount to each task for collaborative UI
    const taskIds = tasks.map((t) => t._id);
    const commentCounts = await Comment.aggregate([
      { $match: { taskId: { $in: taskIds } } },
      { $group: { _id: '$taskId', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    commentCounts.forEach((c) => {
      countMap[String(c._id)] = c.count;
    });

    const enrichedTasks = tasks.map((task) => {
      const obj = task.toObject ? task.toObject() : task;
      obj.commentsCount = countMap[String(obj._id)] || 0;
      return obj;
    });

    res.status(200).json({
      success: true,
      data: {
        tasks: enrichedTasks,
        pagination: { page, limit, totalTasks, totalPages: Math.ceil(totalTasks / limit) }
      }
    });
  } catch (error) {
    next(error);
  }
};

const getTaskStats = async (req, res, next) => {
  try {
    const { scope } = req.query;
    const requestedWorkspaceId = req.headers['x-workspace-id'] || req.query.workspaceId;
    const { workspace } = await getUserActiveWorkspace(req.user, requestedWorkspaceId);
    const memberUserIds = workspace ? await getWorkspaceMemberUserIds(workspace._id) : [req.user._id];

    const matchFilter = scope === 'my'
      ? { userId: req.user._id }
      : {
          $or: [
            { workspaceId: workspace ? workspace._id : null },
            { userId: { $in: memberUserIds } }
          ]
        };
    const now = new Date();

    const [stats] = await Task.aggregate([
      { $match: matchFilter },
      {
        $facet: {
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
                todo: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
                overdue: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ['$status', 'completed'] },
                          { $ne: ['$dueDate', null] },
                          { $lt: ['$dueDate', now] }
                        ]
                      },
                      1,
                      0
                    ]
                  }
                }
              }
            }
          ],
          byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          completedByDay: [
            {
              $match: {
                status: 'completed',
                completedAt: { $gte: new Date(Date.now() - 6 * 86400000) }
              }
            },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);
    const totals = stats.totals[0] || { total: 0, completed: 0, inProgress: 0, todo: 0, overdue: 0 };
    const pendingTasks = totals.inProgress + totals.todo;

    res.status(200).json({
      success: true,
      data: {
        total: totals.total,
        completed: totals.completed,
        pending: pendingTasks,
        overdue: totals.overdue,
        inProgress: totals.inProgress,
        todo: totals.todo,
        completionRate: totals.total ? Math.round((totals.completed / totals.total) * 100) : 0,
        byPriority: stats.byPriority,
        byStatus: stats.byStatus,
        completedByDay: stats.completedByDay
      }
    });
  } catch (error) {
    next(error);
  }
};

const getTaskById = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).populate('userId', 'name email').lean();

    if (!task) {
      return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));
    }

    const hasAccess = await canUserAccessTask(req.user, task);
    if (!hasAccess) {
      return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));
    }

    const commentsCount = await Comment.countDocuments({ taskId: task._id });
    task.commentsCount = commentsCount;

    res.status(200).json({
      success: true,
      data: task
    });
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const { title, description, status, priority, tags, dueDate, reminderAt, recurringInterval } = req.body;

    const task = await Task.findById(req.params.id);

    if (!task) {
      return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));
    }

    const hasAccess = await canUserAccessTask(req.user, task);
    if (!hasAccess) {
      return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));
    }

    const previousStatus = task.status;
    const previousPriority = task.priority;

    if (title !== undefined) {
      task.title = title.trim();
    }

    if (description !== undefined) {
      task.description = typeof description === 'string' ? description.trim() : '';
    }

    if (status !== undefined) {
      task.status = status;
      task.completedAt = status === 'completed' ? (task.completedAt || new Date()) : null;
    }

    if (priority !== undefined) {
      task.priority = priority;
    }

    if (tags !== undefined) {
      task.tags = normalizeTags(tags);
    }

    if (dueDate !== undefined) {
      task.dueDate = dueDate ? new Date(dueDate) : null;
    }
    if (reminderAt !== undefined) {
      task.reminderAt = reminderAt ? new Date(reminderAt) : null;
    }
    if (recurringInterval !== undefined) {
      task.recurringInterval = recurringInterval || null;
      task.isRecurring = Boolean(recurringInterval);
    }

    const updatedTask = await task.save();
    await updatedTask.populate('userId', 'name email');

    if (updatedTask.reminderAt) await scheduleReminderJob(updatedTask, updatedTask.reminderAt, req.user.email);
    else await cancelReminderJob(updatedTask._id);

    logActivity(req.user._id, updatedTask._id, previousStatus !== updatedTask.status && updatedTask.status === 'completed' ? 'TASK_COMPLETED' : 'TASK_UPDATED');
    if (previousStatus !== updatedTask.status && updatedTask.status !== 'completed') logActivity(req.user._id, updatedTask._id, 'STATUS_CHANGED');
    if (previousPriority !== updatedTask.priority) logActivity(req.user._id, updatedTask._id, 'PRIORITY_CHANGED');

    emitForRequest(req, req.user._id, 'task:updated', updatedTask);

    if (previousStatus !== 'completed' && updatedTask.status === 'completed' && updatedTask.isRecurring) {
      const nextTask = await Task.create({
        title: updatedTask.title,
        description: updatedTask.description,
        status: 'todo',
        priority: updatedTask.priority,
        tags: updatedTask.tags,
        dueDate: nextOccurrence(updatedTask),
        isRecurring: true,
        recurringInterval: updatedTask.recurringInterval,
        parentTaskId: updatedTask.parentTaskId || updatedTask._id,
        userId: req.user._id,
        workspaceId: updatedTask.workspaceId || null
      });
      await nextTask.populate('userId', 'name email');
      logActivity(req.user._id, nextTask._id, 'TASK_CREATED');
      emitForRequest(req, req.user._id, 'task:created', nextTask);
    }

    res.status(200).json({
      success: true,
      data: updatedTask
    });
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));
    }

    const hasAccess = await canUserAccessTask(req.user, task);
    if (!hasAccess) {
      return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));
    }

    await Task.findByIdAndDelete(req.params.id);
    await cancelReminderJob(task._id);
    await Comment.deleteMany({ taskId: task._id });
    logActivity(req.user._id, task._id, 'TASK_DELETED');
    emitForRequest(req, req.user._id, 'task:deleted', { _id: task._id, title: task.title });

    res.status(200).json({
      success: true,
      data: {
        message: 'Task deleted successfully',
        id: req.params.id
      }
    });
  } catch (error) {
    next(error);
  }
};

const getActivity = async (req, res, next) => {
  try {
    const requestedWorkspaceId = req.headers['x-workspace-id'] || req.query.workspaceId;
    const { workspace } = await getUserActiveWorkspace(req.user, requestedWorkspaceId);
    const memberUserIds = workspace ? await getWorkspaceMemberUserIds(workspace._id) : [req.user._id];

    const filter = { userId: { $in: memberUserIds } };
    if (req.query.taskId) filter.taskId = req.query.taskId;
    const limit = Number(req.query.limit || 50);

    const activities = await Activity.find(filter)
      .populate('userId', 'name email')
      .populate('taskId', 'title')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, data: activities });
  } catch (error) {
    next(error);
  }
};

const getComments = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).select('_id userId workspaceId');
    if (!task) return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));

    const hasAccess = await canUserAccessTask(req.user, task);
    if (!hasAccess) return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));

    const comments = await Comment.find({ taskId: task._id })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 })
      .lean();
    res.json({ success: true, data: comments });
  } catch (error) {
    next(error);
  }
};

const createComment = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id).select('_id title userId workspaceId');
    if (!task) return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));

    const hasAccess = await canUserAccessTask(req.user, task);
    if (!hasAccess) return next(new AppError('Task not found', 404, 'TASK_NOT_FOUND'));

    const comment = await Comment.create({ taskId: task._id, userId: req.user._id, content: req.body.content.trim() });
    const populated = await Comment.findById(comment._id).populate('userId', 'name email').lean();

    logActivity(req.user._id, task._id, 'COMMENT_ADDED');

    if (req.app.locals.io) {
      req.app.locals.io.to(`task:${task._id}`).emit('comment:created', populated);
      const workspaceRoom = task.workspaceId ? `workspace:${task.workspaceId}` : 'workspace';
      req.app.locals.io.to(workspaceRoom).emit('task:comment-count', { taskId: String(task._id), delta: 1 });
      req.app.locals.io.to(workspaceRoom).emit('notification:new', {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'comment',
        title: task.title,
        message: `${req.user.name || 'Team member'} commented on "${task.title}": "${req.body.content.trim().slice(0, 60)}"`,
        taskId: String(task._id),
        originatorId: String(req.user._id),
        createdAt: new Date().toISOString()
      });
    }

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findOneAndDelete({
      _id: req.params.commentId,
      userId: req.user._id
    });
    if (!comment) return next(new AppError('Comment not found or unauthorized', 404, 'COMMENT_NOT_FOUND'));

    if (req.app.locals.io) {
      req.app.locals.io.to(`task:${comment.taskId}`).emit('comment:deleted', { id: comment._id, taskId: comment.taskId });
      const task = await Task.findById(comment.taskId).select('workspaceId');
      const workspaceRoom = task?.workspaceId ? `workspace:${task.workspaceId}` : 'workspace';
      req.app.locals.io.to(workspaceRoom).emit('task:comment-count', { taskId: String(comment.taskId), delta: -1 });
    }

    res.json({ success: true, data: { id: comment._id } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskStats,
  getTaskById,
  updateTask,
  deleteTask,
  getActivity,
  getComments,
  createComment,
  deleteComment
};
