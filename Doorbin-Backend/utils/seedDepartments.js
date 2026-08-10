const mongoose = require('mongoose');
const Department = require('../models/Department');

const baselineDepartments = [
  {
    name: 'Operations',
    description: 'Responsible for project planning, 3D rendering, animation production, stage execution, and artist workflows.',
    parentDepartment: null,
    status: 'Active'
  },
  {
    name: 'Finance',
    description: 'Handles client quotations, invoicing, payment tracking, project budgets, and studio financial reporting.',
    parentDepartment: null,
    status: 'Active'
  },
  {
    name: 'Human Resource',
    description: 'Manages employee onboarding, department rosters, team attendance, leaves, and HR administration.',
    parentDepartment: null,
    status: 'Active'
  },
  {
    name: 'Business Development',
    description: 'Drives client acquisition, lead management, proposal pipeline, CRM, and business expansion.',
    parentDepartment: null,
    status: 'Active'
  }
];

const seedDepartments = async () => {
  try {
    if (mongoose.connection.readyState === 0) {
      const dbUri = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/doorbin';
      await mongoose.connect(dbUri);
    }

    for (const dept of baselineDepartments) {
      await Department.findOneAndUpdate(
        { name: dept.name },
        { $setOnInsert: dept },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    console.log('✅ Baseline 4 Departments seeded/verified successfully!');
    if (require.main === module) {
      process.exit(0);
    }
  } catch (error) {
    console.error('Error seeding departments:', error.message);
    if (require.main === module) {
      process.exit(1);
    }
  }
};

if (require.main === module) {
  require('dotenv').config();
  seedDepartments();
}

module.exports = seedDepartments;
