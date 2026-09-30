# API reference

Swagger UI is at `/api/docs`. Success responses use `{ success, data }`; errors use `{ success: false, error: { code, message } }`. Protected routes require `Authorization: Bearer <JWT>`.

Authentication: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.

Tasks: `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id`, `GET /api/tasks/stats`, `GET /api/tasks/activity`. Listing accepts search, status, priority, tag(s), dueDate, sortBy, sortOrder, page (default 1), and limit (default 20, max 100). The response includes tasks and pagination metadata.

Comments: `GET/POST /api/tasks/:id/comments`; `DELETE /api/comments/:commentId` (author only). Health: `GET /health`, `GET /health/db`.

Task payloads may include `reminderAt` as an ISO date and `recurringInterval` (`daily`, `weekly`, `monthly`). Reminders require Redis and SMTP configuration.

Socket.IO clients connect with `{ auth: { token } }`. The server joins each validated connection to a private user room and emits `task:created`, `task:updated`, and `task:deleted` events to that user's connected clients.

Authentication uses seven-day JWT access tokens. Tokens cannot be revoked before expiry; refresh-token rotation and server-side revocation are not currently implemented.
