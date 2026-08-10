const mongoose = require('mongoose');
const User = require('./models/User');

async function testAuth() {
  await mongoose.connect('mongodb://localhost:27017/doorbin_visuals');
  const user = await User.findOne({ email: 'op_bd@doorbin.com' });
  console.log('User found:', user ? user.email : 'NOT FOUND');
  if (user) {
    const isMatch = await user.matchPassword('Password123');
    console.log('Password match result:', isMatch);
  }
  process.exit(0);
}

testAuth();
