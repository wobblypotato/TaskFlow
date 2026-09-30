# TaskFlow

TaskFlow is a collaborative task management app built with Node.js, Express, MongoDB, and Socket.IO. It brings task planning, workspace collaboration, and scheduled reminders into one application, with a small browser-based frontend served by the API.

## Features

- Create, update, search, filter, sort, and paginate tasks
- Organize people and tasks in workspaces with member invitations
- Add comments and review task activity
- See live task changes and workspace presence over Socket.IO
- Schedule due-date and recurring-task reminders with BullMQ and Redis
- Manage account details with email and password authentication
- Validate API input with Zod and enforce workspace access checks

## Technology

| Area | Tools |
| --- | --- |
| API | Node.js, Express |
| Data | MongoDB, Mongoose |
| Live updates | Socket.IO |
| Background jobs | BullMQ, Redis |
| Validation and security | Zod, JWT, bcryptjs, express-rate-limit |
| Frontend | HTML, CSS, browser JavaScript |
| Tests | Jest, Supertest |

## Run locally

Requirements: Node.js 20 or newer, MongoDB, and Redis. SMTP is optional and only needed to deliver reminder emails.

```bash
cd backend
npm ci
```

Copy `backend/.env.example` to `backend/.env`, then set `MONGODB_URI` and a unique `JWT_SECRET`. Configure Redis with `REDIS_HOST` and `REDIS_PORT` if it is not running on the local defaults.

Start the API from the `backend` directory:

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000). The API serves the frontend from the same origin.

To run the reminder worker, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and `SMTP_PASS`, then start a second terminal:

```bash
cd backend
npm run worker
```

### Docker Compose

From the repository root, provide a `JWT_SECRET` and start the API, worker, MongoDB, and Redis:

```bash
# PowerShell
$env:JWT_SECRET = "replace-with-a-long-random-secret"
docker compose up --build
```

```bash
# macOS / Linux
JWT_SECRET="replace-with-a-long-random-secret" docker compose up --build
```

Add SMTP environment variables to enable email delivery. Keep `.env` files and real credentials out of source control.

## API

Interactive OpenAPI documentation is available at [`/api/docs`](http://localhost:5000/api/docs). Health endpoints are `/health` and `/health/db`. Protected endpoints use an access token in the `Authorization: Bearer <token>` header; refresh tokens are held in an HTTP-only cookie.

| Resource | Routes |
| --- | --- |
| Authentication | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET/PATCH /api/auth/me` |
| Tasks | `GET/POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/:id`, `GET /api/tasks/stats`, `GET /api/tasks/activity` |
| Comments | `GET/POST /api/tasks/:id/comments`, `DELETE /api/comments/:commentId` |
| Workspaces | `/api/workspaces` (workspace, membership, and invitation routes) |

Task list queries support `search`, `status`, `priority`, `tag`, `dueDate`, `sortBy`, `sortOrder`, `page`, and `limit`.

## Checks

Run from `backend`:

```bash
npm test
npm run build
```

The integration tests require a reachable MongoDB instance configured through `MONGODB_URI`.
