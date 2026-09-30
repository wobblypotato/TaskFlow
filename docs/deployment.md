# Deployment

Build from the repository root with `docker compose up --build`. Production needs persistent MongoDB and Redis, a long random `JWT_SECRET`, an explicit `CORS_ORIGIN`, and SMTP credentials for email reminders. Run one API service and at least one worker. Terminate HTTPS at the platform ingress.

The repository does not select a hosting provider or contain deployment credentials. CI runs tests on pushes and pull requests; configure platform deployment with repository secrets after choosing a provider.
