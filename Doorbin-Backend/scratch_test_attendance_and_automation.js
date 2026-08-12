const http = require('http');
const mongoose = require('mongoose');
require('dotenv').config();

const API_BASE = 'http://localhost:5000/api';

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const fullUrl = API_BASE + path;
    const url = new URL(fullUrl);
    const postData = body ? JSON.stringify(body) : '';

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, json: parsed });
          } else {
            reject({ status: res.statusCode, json: parsed, text: data });
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, isBinary: true, bytes: data.length });
          } else {
            reject({ status: res.statusCode, text: data });
          }
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(postData);
    req.end();
  });
}

async function verifyAttendanceAndAutomation() {
  console.log('================================================================================');
  console.log('--- TESTING ATTENDANCE AUTOMATION, CLOCK IN/OUT, AVERAGE TIME, & MANUAL EDIT ---');
  console.log('================================================================================');

  const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/doorbin';
  await mongoose.connect(dbUri);

  const User = require('./models/User');
  const Attendance = require('./models/Attendance');

  try {
    // Login as Director or Artist
    const loginRes = await request('POST', '/auth/login', { email: 'op_art@doorbin.com', password: 'Password123' });
    const token = loginRes.json.token;
    console.log('✓ Logged in as test user');

    // Clean today's attendance for fresh test
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const artUser = await User.findOne({ email: 'op_art@doorbin.com' });
    await Attendance.deleteMany({ employee: artUser._id, date: today });

    // Test 1: Clock In
    const clockInRes = await request('POST', '/attendance/clock-in', {}, token);
    console.log('✓ Test 1: Clock In successful:', clockInRes.json.message || clockInRes.json);

    // Test 2: Today Attendance
    const todayRes = await request('GET', '/attendance/today', null, token);
    console.log('✓ Test 2: GET /attendance/today verified. Clocked in:', todayRes.json.isClockedIn);

    // Test 3: Clock Out
    const clockOutRes = await request('POST', '/attendance/clock-out', {}, token);
    console.log('✓ Test 3: Clock Out successful:', clockOutRes.json.message || clockOutRes.json);

    // Test 4: Average Attendance
    const avgRes = await request('GET', '/attendance/average', null, token);
    console.log('✓ Test 4: GET /attendance/average verified:', avgRes.json.data);

    // Login as Director to test manual edit
    const dirLogin = await request('POST', '/auth/login', { email: 'op_dir@doorbin.com', password: 'Password123' });
    const dirToken = dirLogin.json.token;

    // Fetch today's record ID
    const todayRecord = await Attendance.findOne({ employee: artUser._id, date: today });

    // Test 5: Manual Edit (HR / Director)
    const editRes = await request('PUT', `/attendance/${todayRecord._id}`, {
      status: 'Present',
      remarks: 'Manually verified punch by Director'
    }, dirToken);
    console.log('✓ Test 5: Manual edit (PUT /attendance/:id) successful:', editRes.json.message);

    // Test 6: Team Summary
    const teamRes = await request('GET', '/attendance/team-summary', null, dirToken);
    console.log('✓ Test 6: Team summary (GET /attendance/team-summary) verified. Total users:', teamRes.json.totalUsers);

    console.log('\n================================================================================');
    console.log('🎉 ALL ATTENDANCE & AUTOMATION TESTS COMPLETED SUCCESSFULLY!');
    console.log('================================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ ATTENDANCE TEST FAILED:', err);
    process.exit(1);
  }
}

verifyAttendanceAndAutomation();
