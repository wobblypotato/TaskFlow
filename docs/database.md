# Database

Users contain a name, unique normalized email, bcrypt password hash, and timestamps. User JSON serialization removes password hashes. Tasks contain their owner, title, description, status, priority, tags, due date, reminder and recurrence metadata. Comments reference task and author. Activity rows capture lifecycle events.

Task indexes support user scoped listing by creation time, status, priority, due date, and tag. The title/description text index supports text query plans; current title substring search is escaped and case-insensitive. Activity and comment indexes support owner and chronological lookup. Unique email indexing prevents duplicate accounts during registration races.
