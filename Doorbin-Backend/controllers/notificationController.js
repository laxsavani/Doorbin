const Notification = require('../models/Notification');
const mongoose = require('mongoose');

// @desc    Get notifications for logged in user
// @route   GET /api/notifications
// @access  Private (Authenticated Users)
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      read: false
    });

    return res.json({
      total: notifications.length,
      unreadCount,
      notifications
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Mark notification as read (or mark all read if id === 'all')
// @route   POST /api/notifications/mark-read
// @access  Private (Authenticated Users)
const markNotificationRead = async (req, res) => {
  const { notificationId } = req.body;

  try {
    if (!notificationId || notificationId === 'all') {
      await Notification.updateMany(
        { recipient: req.user._id, read: false },
        { $set: { read: true } }
      );
      return res.json({ message: 'All notifications marked as read' });
    }

    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();

    return res.json({ message: 'Notification marked as read', notification });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private (Authenticated Users)
const deleteNotification = async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid notification ID' });
  }

  try {
    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    return res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  deleteNotification
};
