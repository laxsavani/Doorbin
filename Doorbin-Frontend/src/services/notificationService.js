import apiClient from './apiClient';

export const notificationService = {
  // Get public VAPID key for web push setup
  async getVapidKey() {
    const res = await apiClient.get('/notifications/vapid-key');
    return res.data;
  },

  // Register browser web push subscription
  async subscribe(subscriptionData) {
    const res = await apiClient.post('/notifications/subscribe', subscriptionData);
    return res.data;
  },

  // Unsubscribe browser web push
  async unsubscribe(subscriptionData) {
    const res = await apiClient.post('/notifications/unsubscribe', subscriptionData);
    return res.data;
  },

  // Send push notification to target user
  async sendPushNotification(payload) {
    const res = await apiClient.post('/notifications/send-push', payload);
    return res.data;
  },

  // Get user notifications list
  async getNotifications() {
    const res = await apiClient.get('/notifications');
    return res.data;
  },

  // Mark notification as read
  async markRead(notificationId) {
    const res = await apiClient.post('/notifications/mark-read', { id: notificationId });
    return res.data;
  },

  // Delete notification
  async deleteNotification(id) {
    const res = await apiClient.delete(`/notifications/${id}`);
    return res.data;
  }
};
