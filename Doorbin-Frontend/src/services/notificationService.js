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
  },

  // Helper to convert VAPID key string to Uint8Array
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  },

  // Auto-register service worker & push subscription with VAPID key
  async registerWebPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Web Push is not supported in this browser.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Notification permission denied by user.');
        return false;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const vapidRes = await this.getVapidKey();
      const vapidPublicKey = vapidRes.publicKey || vapidRes.vapidPublicKey || vapidRes;

      if (!vapidPublicKey || typeof vapidPublicKey !== 'string') {
        console.warn('VAPID public key unavailable.');
        return false;
      }

      const convertedKey = this.urlBase64ToUint8Array(vapidPublicKey);
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
      }

      await this.subscribe(subscription);
      return true;
    } catch (err) {
      console.warn('Web Push registration error:', err.message);
      return false;
    }
  }
};
