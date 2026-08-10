const swaggerJSDoc = require('swagger-jsdoc');

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Doorbin Visuals - Collaborative Project Management System API',
      version: '1.0.0',
      description: 'Complete API Documentation for Doorbin Visuals Platform (Module 1: Auth & RBAC, Module 2: Organization & Department, Module 3: Client Management, Module 4: Business Development CRM, Module 5: Project Management Core, Module 6: Task Management, Module 7: Timeline & Studio Calendar, Module 8: Resource Allocation & Artist Availability, Module 9: Finance Management, Module 10: Human Resource Management HRM, Module 11: Dashboards, Module 12: Reporting & Analytics - Full System Complete)',
      contact: {
        name: 'NexAlliance',
        email: 'support@nexalliance.com'
      }
    },
    servers: [
      {
        url: '/api',
        description: '1. Relative Server (Autoswitch Dev & Prod)'
      },
      {
        url: `http://localhost:${process.env.PORT || 5000}/api`,
        description: '2. Local Development Server'
      },
      {
        url: process.env.RENDER_EXTERNAL_URL ? `${process.env.RENDER_EXTERNAL_URL}/api` : 'https://your-domain.com/api',
        description: '3. Production Cloud Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token in the input field below (e.g. Bearer <token>)'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js', './controllers/*.js']
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

module.exports = swaggerSpec;
