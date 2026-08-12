const webPush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const Notification = require('../models/Notification');

let vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
let vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:support@doorbinvisuals.com';

if (!vapidPublicKey || !vapidPrivateKey) {
  // Generate VAPID keys if not present in environment variables
  const generatedKeys = webPush.generateVAPIDKeys();
  vapidPublicKey = generatedKeys.publicKey;
  vapidPrivateKey = generatedKeys.privateKey;
  console.log('[Web Push] VAPID keys dynamically initialized.');
}

try {
  webPush.setVapidDetails(
    vapidEmail,
    vapidPublicKey,
    vapidPrivateKey
  );
} catch (err) {
  console.error('[Web Push Error] Failed to set VAPID details:', err.message);
}

/**
 * Get public VAPID key
 */
function getVapidPublicKey() {
  return vapidPublicKey;
}

/**
 * Dispatch web push notification to a user's registered devices
 */
async function sendWebPushNotification(userId, notificationPayload) {
  try {
    const subscriptions = await PushSubscription.find({ user: userId });
    if (!subscriptions.length) return { success: false, message: 'No push subscriptions found for user' };

    const payloadString = JSON.stringify({
      title: notificationPayload.title || 'Doorbin Visuals CPMS',
      body: notificationPayload.message || notificationPayload.body || '',
      icon: notificationPayload.icon || '/icon-192.png',
      badge: '/badge-72.png',
      data: {
        url: notificationPayload.linkUrl || '/',
        type: notificationPayload.type || 'INFO',
        refId: notificationPayload.refId || null,
        timestamp: new Date().toISOString()
      }
    });

    const sendPromises = subscriptions.map(async (sub) => {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth
        }
      };

      try {
        await webPush.sendNotification(pushConfig, payloadString);
      } catch (error) {
        // If subscription is expired or unsubscribed, remove from DB
        if (error.statusCode === 410 || error.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
          console.log(`[Web Push] Removed expired subscription: ${sub.endpoint}`);
        } else {
          console.error(`[Web Push Error] Failed to send push to ${sub.endpoint}:`, error.message);
        }
      }
    });

    await Promise.all(sendPromises);
    return { success: true, count: subscriptions.length };
  } catch (error) {
    console.error('[Web Push Error] sendWebPushNotification:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Unified notification helper: Creates DB notification + triggers Web Push Notification
 */
async function notifyUser({ user, recipient, title, message, type = 'INFO', linkUrl = '', refId = null, metadata = {} }) {
  try {
    const targetUser = recipient || user;
    if (!targetUser) return null;

    const notif = await Notification.create({
      user: targetUser,
      recipient: targetUser,
      title,
      message,
      type,
      linkUrl,
      refId,
      metadata
    });

    // Asynchronously dispatch Web Push Notification
    sendWebPushNotification(targetUser, { title, message, type, linkUrl, refId }).catch(err => {
      console.error('[Notification Helper Error] Web Push dispatch failed:', err.message);
    });

    return notif;
  } catch (error) {
    console.error('[Notification Helper Error] notifyUser failed:', error.message);
    return null;
  }
}

module.exports = {
  getVapidPublicKey,
  sendWebPushNotification,
  notifyUser
};
