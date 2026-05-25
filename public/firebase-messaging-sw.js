importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

async function bootFirebaseMessaging() {
  try {
    const res = await fetch('/api/firebase-config');
    const config = await res.json();

    if (!config.apiKey || !config.messagingSenderId || !config.appId || !config.projectId) {
      return;
    }

    firebase.initializeApp({
      apiKey: config.apiKey,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      projectId: config.projectId,
    });

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      const notification = payload.notification || {};
      const data = payload.data || {};

      self.registration.showNotification(notification.title || 'ChargeShare', {
        body: notification.body || 'You have a new update.',
        icon: '/globe.svg',
        badge: '/globe.svg',
        data,
      });
    });
  } catch (error) {
    console.error('[firebase-messaging-sw] init failed', error);
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const sessionId = event.notification.data && event.notification.data.session_id;
  const target = sessionId ? `/session/${sessionId}` : '/notifications';
  event.waitUntil(clients.openWindow(target));
});

bootFirebaseMessaging();
