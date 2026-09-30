const swaggerJsdoc = require('swagger-jsdoc');
module.exports = swaggerJsdoc({
  apis: [],
  definition: {
    openapi: '3.0.3',
    info: { title: 'TaskFlow API', version: '1.0.0', description: 'Task management API. All task, activity, and comment endpoints require a bearer JWT.' },
    servers: [{ url: '/' }],
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } }, schemas: {
      Error: { type: 'object', properties: { success: { type: 'boolean', example: false }, error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } } } },
      RegisterInput: { type: 'object', required: ['name', 'email', 'password'], properties: { name: { type: 'string', maxLength: 100 }, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 6 } } },
      LoginInput: { type: 'object', required: ['email', 'password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } },
      TaskInput: { type: 'object', required: ['title'], properties: { title: { type: 'string', maxLength: 200 }, description: { type: 'string', maxLength: 2000 }, status: { type: 'string', enum: ['todo', 'in-progress', 'completed'] }, priority: { type: 'string', enum: ['low', 'medium', 'high'] }, tags: { type: 'array', items: { type: 'string' } }, dueDate: { type: 'string', format: 'date-time', nullable: true }, reminderAt: { type: 'string', format: 'date-time', nullable: true }, recurringInterval: { type: 'string', enum: ['daily', 'weekly', 'monthly'], nullable: true } } },
      TaskUpdate: { type: 'object', properties: { title: { type: 'string', maxLength: 200 }, description: { type: 'string', maxLength: 2000 }, status: { type: 'string', enum: ['todo', 'in-progress', 'completed'] }, priority: { type: 'string', enum: ['low', 'medium', 'high'] }, tags: { type: 'array', items: { type: 'string' } }, dueDate: { type: 'string', format: 'date-time', nullable: true }, reminderAt: { type: 'string', format: 'date-time', nullable: true }, recurringInterval: { type: 'string', enum: ['daily', 'weekly', 'monthly'], nullable: true } } },
      CommentInput: { type: 'object', required: ['content'], properties: { content: { type: 'string', maxLength: 2000 } } }
    } },
    paths: {
      '/api/auth/register': { post: { summary: 'Register', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } } } }, responses: { 201: { description: 'Account created' }, 400: { description: 'Invalid input' }, 409: { description: 'Email already registered' }, 429: { description: 'Too many requests' } } } },
      '/api/auth/login': { post: { summary: 'Login', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } } }, responses: { 200: { description: 'JWT and user' }, 401: { description: 'Invalid credentials' }, 429: { description: 'Too many requests' } } } },
      '/api/auth/me': { get: { security: [{ bearerAuth: [] }], summary: 'Current user', responses: { 200: { description: 'User profile' } } } },
      '/api/tasks': {
        get: { security: [{ bearerAuth: [] }], summary: 'Search and list tasks', parameters: ['search','status','priority','tags','tag','dueDate','sortBy','sortOrder','page','limit'].map((name) => ({ in: 'query', name, schema: { type: 'string' } })), responses: { 200: { description: 'Paginated task list' }, 400: { description: 'Invalid query' } } },
        post: { security: [{ bearerAuth: [] }], summary: 'Create task', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskInput' } } } }, responses: { 201: { description: 'Created task' }, 400: { description: 'Invalid task input' }, 401: { description: 'Unauthorized' } } }
      },
      '/api/tasks/{id}': { parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string' } }], get: { security: [{ bearerAuth: [] }], summary: 'Read task', responses: { 200: { description: 'Task' }, 404: { description: 'Not found' } } }, patch: { security: [{ bearerAuth: [] }], summary: 'Update task', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskUpdate' } } } }, responses: { 200: { description: 'Updated task' }, 400: { description: 'Invalid task input' }, 404: { description: 'Not found' } } }, delete: { security: [{ bearerAuth: [] }], summary: 'Delete task', responses: { 200: { description: 'Deleted task' }, 404: { description: 'Not found' } } } },
      '/api/tasks/{id}/comments': { get: { security: [{ bearerAuth: [] }], summary: 'List task comments', responses: { 200: { description: 'Comments' } } }, post: { security: [{ bearerAuth: [] }], summary: 'Add a comment', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CommentInput' } } } }, responses: { 201: { description: 'Created comment' }, 400: { description: 'Invalid comment' } } } },
      '/api/comments/{commentId}': { delete: { security: [{ bearerAuth: [] }], summary: 'Delete own comment', responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } } } },
      '/api/tasks/activity': { get: { security: [{ bearerAuth: [] }], summary: 'Recent task activity', responses: { 200: { description: 'Activity entries' } } } },
      '/health': { get: { summary: 'Service health', responses: { 200: { description: 'Healthy' } } } },
      '/health/db': { get: { summary: 'Database health', responses: { 200: { description: 'Connected' }, 503: { description: 'Disconnected' } } } }
    }
  }
});
