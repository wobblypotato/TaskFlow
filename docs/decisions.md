# Engineering decisions

- **MongoDB:** Task records have flexible tags and optional recurrence/reminder fields, with explicit ownership and Mongoose validation.
- **Redis:** Holds delayed reminder jobs so API and worker processes stay independent. Broad caching is omitted because data changes often and no measured need was found.
- **BullMQ:** Provides delayed jobs and retries without holding API requests open.
- **Socket.IO:** Pushes task changes to the authenticated user's room; events are not broadcast across users.
- **JWT:** Keeps the single-user-per-account API stateless. Tokens are signed only with environment configuration.
- **Indexes:** Compound indexes begin with `userId` because reads are owner scoped; trailing fields match common filters and sorts. Tag is multikey. Activity and comments are indexed by their read patterns.

No performance benchmark is claimed. Production query profiling should guide additional indexes or caching.
