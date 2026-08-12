const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const { getVapidPublicKey, sendWebPushNotification, notifyUser } = require('../utils/webPushHelper');
const mongoose = require('mongoose');

// @desc    Get public VAPID key for client web push subscription
// @route   GET /api/notifications/vapid-key
// @access  Public / Private
const getVapidKey = async (req, res) => {
  try {
    const publicKey = getVapidPublicKey();
    return res.json({
      success: true,
      publicKey,
      vapidPublicKey: publicKey
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Subscribe browser/device to Web Push Notifications
// @route   POST /api/notifications/subscribe
// @access  Private (Authenticated Users)
const subscribePush = async (req, res) => {
  try {
    const { endpoint, keys, subscription, userAgent } = req.body;
    const subEndpoint = endpoint || subscription?.endpoint;
    const subKeys = keys || subscription?.keys;

    if (!subEndpoint || !subKeys || !subKeys.p256dh || !subKeys.auth) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Web Push Subscription. endpoint and keys (p256dh, auth) are required.'
      });
    }

    const pushSub = await PushSubscription.findOneAndUpdate(
      { endpoint: subEndpoint },
      {
        user: req.user._id,
        endpoint: subEndpoint,
        keys: subKeys,
        userAgent: userAgent || req.headers['user-agent']
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      success: true,
      message: 'Web Push notification subscription registered successfully',
      data: pushSub
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unsubscribe browser/device from Web Push Notifications
// @route   POST /api/notifications/unsubscribe
// @access  Private (Authenticated Users)
const unsubscribePush = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'Subscription endpoint is required' });
    }

    await PushSubscription.deleteOne({ endpoint, user: req.user._id });
    return res.json({
      success: true,
      message: 'Unsubscribed from Web Push notifications'
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Trigger web push notification to a specific user (Admin / System)
// @route   POST /api/notifications/send-push
// @access  Private (Authenticated Users)
const sendPushTest = async (req, res) => {
  try {
    const { userId, title, message, linkUrl, type } = req.body;
    const targetUserId = userId || req.user._id;

    const notifResult = await notifyUser({
      user: targetUserId,
      title: title || 'Doorbin Visuals Alert',
      message: message || 'Test Web Push Notification delivery',
      type: type || 'INFO',
      linkUrl: linkUrl || '/'
    });

    return res.json({
      success: true,
      message: 'Push notification triggered successfully',
      notification: notifResult
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get notifications for logged in user
// @route   GET /api/notifications
// @access  Private (Authenticated Users)
const getNotifications = async (req, res) => {
  try {
    const query = {
      $or: [
        { recipient: req.user._id },
        { user: req.user._id }
      ]
    };

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      ...query,
      $or: [{ read: false }, { isRead: false }]
    });

    return res.json({
      success: true,
      total: notifications.length,
      unreadCount,
      notifications
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark notification as read (or mark all read if id === 'all')
// @route   POST /api/notifications/mark-read
// @access  Private (Authenticated Users)
const markNotificationRead = async (req, res) => {
  const { notificationId } = req.body;

  try {
    const userMatch = { $or: [{ recipient: req.user._id }, { user: req.user._id }] };

    if (!notificationId || notificationId === 'all') {
      await Notification.updateMany(
        userMatch,
        { $set: { read: true, isRead: true } }
      );
      return res.json({ success: true, message: 'All notifications marked as read' });
    }

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ success: false, message: 'Invalid notification ID' });
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      ...userMatch
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    notification.read = true;
    notification.isRead = true;
    await notification.save();

    return res.json({ success: true, message: 'Notification marked as read', notification });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private (Authenticated Users)
const deleteNotification = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid notification ID' });
  }

  try {
    const notification = await Notification.findOneAndDelete({
      _id: id,
      $or: [{ recipient: req.user._id }, { user: req.user._id }]
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getVapidKey,
  subscribePush,
  unsubscribePush,
  sendPushTest,
  getNotifications,
  markNotificationRead,
  deleteNotification
};
