require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error.middleware');

const app = express();

// Connect to MongoDB
// Deferred to app.listen

// Middleware
app.use(express.json());
app.use(morgan('dev'));

// Swagger UI Setup
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'swagger.yaml'));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Friendly root route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Finance Dashboard API is running!',
    version: '1.0.0',
    documentation: '/api/v1/health',
    endpoints: {
      auth: '/api/v1/auth',
      users: '/api/v1/users',
      records: '/api/v1/records',
      dashboard: '/api/v1/dashboard'
    }
  });
});

// Routes
const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const recordsRoutes = require('./modules/records/records.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', usersRoutes);
app.use('/api/v1/records', recordsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  let dbStatus = 'disconnected';
  
  if (dbState === 1) dbStatus = 'connected';
  else if (dbState === 2) dbStatus = 'connecting';
  else if (dbState === 3) dbStatus = 'disconnecting';
  
  if (dbStatus === 'connected') {
    return res.status(200).json({ status: 'ok', db: dbStatus });
  } else {
    // Return 503 if DB is not connected
    return res.status(503).json({ status: 'error', db: dbStatus });
  }
});

// Unknown routes
app.use((req, res, next) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    }
  });
});

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
if (require.main === module) {
    connectDB().then(() => {
        app.listen(PORT, () => {
            console.log(`Server listening at http://localhost:${PORT}`);
        });
    });
}

module.exports = app;
