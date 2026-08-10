const mongoose = require('mongoose');
require('dotenv').config();
const Role = require('../models/Role');

const rolesData = [
  {
    name: 'Director',
    permissions: {
      userManagement: true,
      departmentManagement: true,
      projectManagement: true,
      taskManagement: true,
      financeAccess: true,
      hrAccess: true,
      businessDevAccess: true,
      reportsAccess: true,
      dashboardAccess: true,
      resourceAllocation: true,
      calendarAccess: true,
      timelineAccess: true,
      deleteProjects: true,
      systemConfiguration: true
    }
  },
  {
    name: 'Production Manager',
    permissions: {
      userManagement: false,
      departmentManagement: false,
      projectManagement: true,
      taskManagement: true,
      financeAccess: false,
      hrAccess: false,
      businessDevAccess: false,
      reportsAccess: true,
      dashboardAccess: true,
      resourceAllocation: true,
      calendarAccess: true,
      timelineAccess: true,
      deleteProjects: false,
      systemConfiguration: false
    }
  },
  {
    name: 'Artist',
    permissions: {
      userManagement: false,
      departmentManagement: false,
      projectManagement: false,
      taskManagement: true,
      financeAccess: false,
      hrAccess: false,
      businessDevAccess: false,
      reportsAccess: false,
      dashboardAccess: true,
      resourceAllocation: false,
      calendarAccess: true,
      timelineAccess: false,
      deleteProjects: false,
      systemConfiguration: false
    }
  },
  {
    name: 'Human Resource',
    permissions: {
      userManagement: false,
      departmentManagement: false,
      projectManagement: false,
      taskManagement: false,
      financeAccess: false,
      hrAccess: true,
      businessDevAccess: false,
      reportsAccess: true,
      dashboardAccess: true,
      resourceAllocation: false,
      calendarAccess: true,
      timelineAccess: false,
      deleteProjects: false,
      systemConfiguration: false
    }
  },
  {
    name: 'Business Development Manager',
    permissions: {
      userManagement: false,
      departmentManagement: false,
      projectManagement: false,
      taskManagement: false,
      financeAccess: true,
      hrAccess: false,
      businessDevAccess: true,
      reportsAccess: true,
      dashboardAccess: true,
      resourceAllocation: false,
      calendarAccess: true,
      timelineAccess: false,
      deleteProjects: false,
      systemConfiguration: false
    }
  }
];

const seedRoles = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      const dbUri = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doorbin';
      await mongoose.connect(dbUri);
      console.log('MongoDB connected for seeding roles...');
    }

    for (const role of rolesData) {
      await Role.findOneAndUpdate(
        { name: role.name },
        role,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`Seeded/Updated role: ${role.name}`);
    }

    console.log('Roles seeding complete!');
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error seeding roles:', error.message);
    if (require.main === module) {
      process.exit(1);
    }
  }
};

if (require.main === module) {
  seedRoles();
}

module.exports = seedRoles;
