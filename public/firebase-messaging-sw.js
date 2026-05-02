importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// These values should match your firebase-applet-config.json
firebase.initializeApp({
  apiKey: "AIzaSyCcUzhIhhYFt42c0HUbeRy-BNai9vkfDDc",
  authDomain: "gen-lang-client-0920310031.firebaseapp.com",
  projectId: "gen-lang-client-0920310031",
  storageBucket: "gen-lang-client-0920310031.firebasestorage.app",
  messagingSenderId: "577385179298",
  appId: "1:577385179298:web:c8d9328f6fc17fef00cffb"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.image || '/favicon.ico'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
