require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const WorkspaceMember = require('./models/WorkspaceMember');

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured in production');
}

// Start Express HTTP server immediately
const server = app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`🚀 TaskFlow Server running on port ${PORT}`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`📡 API URL:   http://localhost:${PORT}/api`);
  console.log(`========================================`);
});

const io = new Server(server, { cors: { origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true } });

// In-memory presence tracking for collaborative workspace
const onlineUsersMap = new Map(); // userId -> { id, name, email, count }
const taskViewersMap = new Map(); // taskId -> Map(userId -> name)

function broadcastOnlineUsers() {
  const usersList = Array.from(onlineUsersMap.values()).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email
  }));
  io.emit('presence:online-users', usersList);
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token || !process.env.JWT_SECRET) return next(new Error('Unauthorized'));
    const user = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = String(user.id);
    const dbUser = await User.findById(user.id).select('name email').lean();
    socket.userName = dbUser?.name || 'Workspace Member';
    socket.userEmail = dbUser?.email || '';
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  socket.join(`user:${socket.userId}`);
  socket.join('workspace');

  // Join all workspaces this user is a member of
  WorkspaceMember.find({ userId: socket.userId })
    .select('workspaceId')
    .lean()
    .then((memberships) => {
      memberships.forEach((m) => socket.join(`workspace:${m.workspaceId}`));
    })
    .catch(() => {});

  socket.on('workspace:join', (workspaceId) => {
    if (workspaceId) socket.join(`workspace:${workspaceId}`);
  });

  // Track online connection
  if (!onlineUsersMap.has(socket.userId)) {
    onlineUsersMap.set(socket.userId, {
      id: socket.userId,
      name: socket.userName,
      email: socket.userEmail,
      count: 1
    });
  } else {
    onlineUsersMap.get(socket.userId).count += 1;
  }
  broadcastOnlineUsers();

  // Task viewing presence (who is currently viewing this task)
  socket.on('task:join', (taskId) => {
    if (!taskId) return;
    socket.join(`task:${taskId}`);
    if (!taskViewersMap.has(taskId)) {
      taskViewersMap.set(taskId, new Map());
    }
    taskViewersMap.get(taskId).set(socket.userId, socket.userName);
    const viewers = Array.from(taskViewersMap.get(taskId).entries()).map(([id, name]) => ({ id, name }));
    io.to(`task:${taskId}`).emit('task:viewers', { taskId, viewers });
  });

  socket.on('task:leave', (taskId) => {
    if (!taskId) return;
    socket.leave(`task:${taskId}`);
    if (taskViewersMap.has(taskId)) {
      taskViewersMap.get(taskId).delete(socket.userId);
      const viewers = Array.from(taskViewersMap.get(taskId).entries()).map(([id, name]) => ({ id, name }));
      io.to(`task:${taskId}`).emit('task:viewers', { taskId, viewers });
    }
  });

  socket.on('disconnect', () => {
    const existing = onlineUsersMap.get(socket.userId);
    if (existing) {
      existing.count -= 1;
      if (existing.count <= 0) {
        onlineUsersMap.delete(socket.userId);
      }
    }

    // Clean up task viewers on disconnect
    for (const [taskId, viewersMap] of taskViewersMap.entries()) {
      if (viewersMap.has(socket.userId)) {
        viewersMap.delete(socket.userId);
        const viewers = Array.from(viewersMap.entries()).map(([id, name]) => ({ id, name }));
        io.to(`task:${taskId}`).emit('task:viewers', { taskId, viewers });
      }
    }

    broadcastOnlineUsers();
  });
});

app.locals.io = io;

// Connect to MongoDB in background
connectDB();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error(`[TaskFlow Unhandled Rejection]: ${err.message}`);
});
