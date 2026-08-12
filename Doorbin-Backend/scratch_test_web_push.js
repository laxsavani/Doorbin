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

async function verifyWebPushNotifications() {
  console.log('================================================================================');
  console.log('--- TESTING WEB PUSH NOTIFICATIONS & INTEGRATED SYSTEM NOTIFICATIONS ---');
  console.log('================================================================================');

  const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/doorbin';
  await mongoose.connect(dbUri);

  try {
    // 1. Get VAPID Public Key (Public Route)
    const vapidRes = await request('GET', '/notifications/vapid-key');
    console.log('✓ Test 1: GET /notifications/vapid-key successful. Key len:', vapidRes.json.publicKey?.length);

    // 2. Login as Artist
    const loginRes = await request('POST', '/auth/login', { email: 'op_art@doorbin.com', password: 'Password123' });
    const token = loginRes.json.token;
    console.log('✓ Test 2: User authenticated');

    // 3. Subscribe to Web Push
    const dummyEndpoint = `https://fcm.googleapis.com/fcm/send/test-token-${Date.now()}`;
    const subRes = await request('POST', '/notifications/subscribe', {
      endpoint: dummyEndpoint,
      keys: {
        p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_n1D9Q2W1g9rX2V0y7o5_T9U7xR4w5_2y_8z0y',
        auth: 't8y7xR4w52y8z0y'
      },
      userAgent: 'Mozilla/5.0 Test Suite'
    }, token);
    console.log('✓ Test 3: POST /notifications/subscribe successful:', subRes.json.message);

    // 4. Send Web Push Test Notification
    const sendPushRes = await request('POST', '/notifications/send-push', {
      title: 'Project Stage Approved',
      message: 'Stage 1 - Scene Preparation has been approved by Production Manager.',
      type: 'PROJECT'
    }, token);
    console.log('✓ Test 4: POST /notifications/send-push successful:', sendPushRes.json.message);

    // 5. Get User Notifications
    const notifsRes = await request('GET', '/notifications', null, token);
    console.log('✓ Test 5: GET /notifications verified. Unread count:', notifsRes.json.unreadCount);

    // 6. Mark Read
    const markReadRes = await request('POST', '/notifications/mark-read', { notificationId: 'all' }, token);
    console.log('✓ Test 6: POST /notifications/mark-read successful:', markReadRes.json.message);

    // 7. Unsubscribe
    const unsubRes = await request('POST', '/notifications/unsubscribe', { endpoint: dummyEndpoint }, token);
    console.log('✓ Test 7: POST /notifications/unsubscribe successful:', unsubRes.json.message);

    console.log('\n================================================================================');
    console.log('🎉 ALL WEB PUSH NOTIFICATION TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ WEB PUSH TEST FAILED:', err);
    process.exit(1);
  }
}

verifyWebPushNotifications();
