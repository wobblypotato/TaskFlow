const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const authRoutes = require('./routes/auth.routes');
const taskRoutes = require('./routes/task.routes');
const commentRoutes = require('./routes/comment.routes');
const workspaceRoutes = require('./routes/workspace.routes');
const { errorHandler, AppError } = require('./middleware/error.middleware');

const app = express();

app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : true;

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => console.info(JSON.stringify({ type: 'http', method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - started })));
  next();
});

// Body & cookie parser middlewares
app.use(express.json({ limit: '1.5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve frontend static assets
const frontendDir = path.join(__dirname, '../../frontend');
app.use(express.static(frontendDir));

// Health check endpoints (always accessible)
app.get('/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      app: 'TaskFlow MVP API',
      database: isDbConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    }
  });
});
app.get('/health/db', (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({ status: connected ? 'healthy' : 'unhealthy', database: connected ? 'connected' : 'disconnected', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => res.redirect(308, '/health'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Light global rate limiter on all /api/* routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.'
    }
  }
});

// Stricter rate limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Try again later.'
    }
  }
});

// Guard: verify database is connected for all subsequent /api endpoints
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'DATABASE_DISCONNECTED',
        message: 'Database is not connected. Please ensure MongoDB is running locally or set MONGODB_URI in backend/.env'
      }
    });
  }
  next();
});

// Apply light global limiter to all /api routes
app.use('/api', apiLimiter);

// Mount REST API endpoints
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/workspaces', workspaceRoutes);

// Handle 404 for unknown API endpoints
app.all('/api/*', (req, res, next) => {
  next(new AppError(`API endpoint '${req.originalUrl}' not found on this server`, 404, 'ROUTE_NOT_FOUND'));
});

// Catch-all route to serve frontend index.html for navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
