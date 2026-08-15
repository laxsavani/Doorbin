const mongoose = require('mongoose');

const connectDB = async () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const dbUri = (nodeEnv === 'production' ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI) ||
    process.env.MONGODB_URI ||
    process.env.MONGODB_URI_PROD ||
    process.env.MONGODB_URI_DEV ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL ||
    (nodeEnv === 'development' ? 'mongodb://127.0.0.1:27017/doorbin' : null);

  const dbType = nodeEnv === 'production' ? 'Production (Online)' : 'Development (Local)';

  console.log(`🔌 Attempting to connect to ${dbType} MongoDB...`);

  if (!dbUri) {
    console.error(`❌ MongoDB Connection Error: No connection URI defined in environment variables (MONGODB_URI / MONGODB_URI_PROD).`);
    console.error(`👉 Please set MONGODB_URI in your environment settings (e.g. Render environment variables).`);
    return null;
  }

  try {
    const conn = await mongoose.connect(dbUri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host} (${dbType})`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error (${dbType}): ${error.message}`);
    return null;
  }
};

module.exports = connectDB;
