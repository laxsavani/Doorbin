const express = require('express');
const cors = require('cors');
const compression = require('compression');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const connectDB = require('./config/db');
const seedRoles = require('./utils/seedRoles');
const seedDepartments = require('./utils/seedDepartments');
const seedWorkflowTemplates = require('./utils/seedWorkflowTemplates');

// Load environment variables from single .env file
dotenv.config();

// Ensure models are registered with Mongoose
require('./models/Role');
require('./models/Department');
require('./models/User');
require('./models/Client');
require('./models/Enquiry');
require('./models/WorkflowTemplate');
require('./models/Project');
require('./models/Stage');
require('./models/Task');
require('./models/RescheduleLog');
require('./models/ArtistProfile');
require('./models/Quotation');
require('./models/Invoice');
require('./models/Payment');
require('./models/ProjectMilestonePayment');
require('./models/ProjectMilestonePayment');
require('./models/FinanceSettings');
require('./models/FinanceCounter');
require('./models/Employee');
require('./models/Attendance');
require('./models/Leave');
require('./models/Holiday');
require('./models/PerformanceReview');
require('./models/ScheduledReport');
require('./models/ActivityLog');
require('./models/Notification');
require('./models/PushSubscription');

const { initScheduledReportCron } = require('./services/scheduledReportService');
const initAllCronJobs = require('./jobs');

const app = express();

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Enhanced Performance Timing Middleware (TTFB & Sub-routine Breakdown)
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  req._startTime = start;

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const totalMs = (Number(end - start) / 1_000_000).toFixed(2);
    const authMs = req.authMs ? req.authMs.toFixed(2) : '0.00';
    const dbMs = req.dbMs ? req.dbMs.toFixed(2) : '0.00';
    const controllerMs = req.controllerMs ? req.controllerMs.toFixed(2) : (totalMs - authMs - dbMs).toFixed(2);

    if (process.env.NODE_ENV !== 'test') {
      console.log(`[PERF] ${req.method} ${req.originalUrl} -> ${res.statusCode} | Total: ${totalMs}ms (Auth: ${authMs}ms, DB: ${dbMs}ms, Ctrl: ${controllerMs}ms)`);
    }
  });
  next();
});

// Serve Swagger UI documentation at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/health', require('./routes/healthRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/roles', require('./routes/roleRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/clients', require('./routes/clientRoutes'));
app.use('/api/enquiries', require('./routes/enquiryRoutes'));
app.use('/api/workflow-templates', require('./routes/workflowTemplateRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/tasks', require('./routes/taskRoutes'));
app.use('/api', require('./routes/timelineRoutes'));
app.use('/api/resources', require('./routes/resourceRoutes'));
app.use('/api/finance/milestone-tracker', require('./routes/milestoneTrackerRoutes'));
app.use('/api/finance/milestone-tracker', require('./routes/milestoneTrackerRoutes'));
app.use('/api/finance', require('./routes/financeRoutes'));
app.use('/api/hr', require('./routes/hrRoutes'));
app.use('/api/attendance', require('./routes/attendanceRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/activity-logs', require('./routes/activityLogRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

// Initialize background scheduled report & automation cron jobs
if (process.env.NODE_ENV !== 'test') {
  initScheduledReportCron();
  initAllCronJobs();
}

// Health check / base route
app.get('/', (req, res) => {
  res.json({
    system: 'Doorbin Visuals - Collaborative Project Management System',
    module: 'Module 12: Reporting & Analytics (Full 12-Module System Complete)',
    healthCheck: `${req.protocol}://${req.get('host')}/api/health`,
    swaggerDocs: `${req.protocol}://${req.get('host')}/api-docs`,
    environment: process.env.NODE_ENV || 'development',
    status: 'Active',
    timestamp: new Date()
  });
});

// 404 Handler
app.use((req, res, next) => {
  res.status(404).json({ message: `Route not found - ${req.originalUrl}` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.error('Unhandled Error:', err.stack);
  } else {
    console.error('Unhandled Error:', err.message);
  }
  
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log(`Doorbin System Server running on port ${PORT} in [${process.env.NODE_ENV || 'development'}] mode`);
      console.log(`Swagger Documentation available at http://localhost:${PORT}/api-docs`);
      console.log(`Health check available at http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Server startup failed:', error.message);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = app;

