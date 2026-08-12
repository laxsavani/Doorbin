const express = require('express');
const router = express.Router();
const {
  getVapidKey,
  subscribePush,
  unsubscribePush,
  sendPushTest,
  getNotifications,
  markNotificationRead,
  deleteNotification
} = require('../controllers/notificationController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/vapid-key', getVapidKey);
router.post('/subscribe', protect, subscribePush);
router.post('/unsubscribe', protect, unsubscribePush);
router.post('/send-push', protect, sendPushTest);

router.get('/', protect, getNotifications);
router.post('/mark-read', protect, markNotificationRead);
router.delete('/:id', protect, deleteNotification);

module.exports = router;
