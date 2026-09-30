# Architecture

The static vanilla frontend is served by Express. It calls `/api` with a bearer JWT and connects to Socket.IO using the same token. Express scopes task, activity, and comment reads to the authenticated user. MongoDB stores app data. BullMQ places reminder jobs in Redis; a separate worker reloads each task before sending mail so canceled or completed reminders are skipped.

```text
Browser ── HTTP/Socket.IO ── Express ── Mongoose ── MongoDB
                                  └── BullMQ ── Redis ── Worker ── SMTP
```

Run API and worker as separate processes in production. Configure TLS and trusted CORS origins at the deployment edge.
