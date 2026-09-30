const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ID format');

const createTaskSchema = {
  body: z.object({
    title: z
      .string({ required_error: 'Task title is required' })
      .trim()
      .min(1, 'Task title is required')
      .max(200, 'Title cannot exceed 200 characters'),
    description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional().default(''),
    status: z.enum(['todo', 'in-progress', 'completed'], {
      errorMap: () => ({ message: 'Status must be todo, in-progress, or completed' })
    }).optional().default('todo'),
    priority: z.enum(['low', 'medium', 'high'], {
      errorMap: () => ({ message: 'Priority must be low, medium, or high' })
    }).optional().default('medium'),
    tags: z.union([z.array(z.string()), z.string()]).optional().default([]),
    dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Due date must be a valid date' }).nullable().optional(),
    reminderAt: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Reminder must be a valid date' }).nullable().optional(),
    recurringInterval: z.enum(['daily', 'weekly', 'monthly']).nullable().optional(),
    workspaceId: objectIdSchema.optional()
  })
};

const updateTaskSchema = {
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    title: z.string().trim().min(1, 'Task title cannot be empty').max(200, 'Title cannot exceed 200 characters').optional(),
    description: z.string().max(2000, 'Description cannot exceed 2000 characters').optional(),
    status: z.enum(['todo', 'in-progress', 'completed'], {
      errorMap: () => ({ message: 'Status must be todo, in-progress, or completed' })
    }).optional(),
    priority: z.enum(['low', 'medium', 'high'], {
      errorMap: () => ({ message: 'Priority must be low, medium, or high' })
    }).optional(),
    tags: z.union([z.array(z.string()), z.string()]).optional(),
    dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Due date must be a valid date' }).nullable().optional(),
    reminderAt: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Reminder must be a valid date' }).nullable().optional(),
    recurringInterval: z.enum(['daily', 'weekly', 'monthly']).nullable().optional()
  })
};

const taskIdParamSchema = {
  params: z.object({
    id: objectIdSchema
  })
};

const getTasksSchema = {
  query: z.object({
    search: z.string().optional(),
    status: z.enum(['todo', 'in-progress', 'completed'], {
      errorMap: () => ({ message: 'Invalid status filter' })
    }).optional(),
    priority: z.enum(['low', 'medium', 'high'], {
      errorMap: () => ({ message: 'Invalid priority filter' })
    }).optional(),
    tag: z.string().optional(),
    tags: z.string().optional(),
    dueDate: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
    scope: z.enum(['my', 'workspace']).optional(),
    page: z.coerce.number().int().positive('Page must be positive').optional().default(1),
    limit: z.coerce.number().int().min(1).max(100, 'Limit must be between 1 and 100').optional().default(20),
    workspaceId: objectIdSchema.optional()
  })
};

const getTaskStatsSchema = {
  query: z.object({
    scope: z.enum(['my', 'workspace']).optional(),
    workspaceId: objectIdSchema.optional()
  })
};

const getActivitySchema = {
  query: z.object({
    taskId: objectIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    workspaceId: objectIdSchema.optional()
  })
};

const createCommentSchema = {
  params: z.object({
    id: objectIdSchema
  }),
  body: z.object({
    content: z
      .string({ required_error: 'Comment content is required' })
      .trim()
      .min(1, 'Comment content is required')
      .max(1000, 'Comment cannot exceed 1000 characters')
  })
};

const deleteCommentSchema = {
  params: z.object({
    commentId: objectIdSchema
  })
};

module.exports = {
  createTaskSchema,
  updateTaskSchema,
  taskIdParamSchema,
  getTasksSchema,
  getTaskStatsSchema,
  getActivitySchema,
  createCommentSchema,
  deleteCommentSchema,
  objectIdSchema
};
