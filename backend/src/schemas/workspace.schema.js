const { z } = require('zod');

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z.string().regex(objectIdRegex, 'Invalid ID format');

const createInvitationSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Valid email is required' })
      .trim()
      .toLowerCase()
      .email('Valid email is required'),
    role: z.enum(['admin', 'member'], {
      errorMap: () => ({ message: 'Role must be either admin or member' })
    }).optional().default('member')
  }),
  query: z.object({
    workspaceId: objectIdSchema.optional()
  }).optional()
};

const invitationIdParamSchema = {
  params: z.object({
    id: objectIdSchema
  })
};

const workspaceQuerySchema = {
  query: z.object({
    workspaceId: objectIdSchema.optional(),
    status: z.string().optional()
  }).optional()
};

module.exports = {
  createInvitationSchema,
  invitationIdParamSchema,
  workspaceQuerySchema,
  objectIdSchema
};
