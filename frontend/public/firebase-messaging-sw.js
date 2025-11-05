/* global self */
// Lazy initialize Firebase only after we receive config from the page.

self.addEventListener('install', function() {
	self.skipWaiting();
});

self.addEventListener('activate', function(event) {
	event.waitUntil(self.clients.claim());
});

let initialized = false;

self.addEventListener('message', function(event) {
	try {
		var data = event && event.data ? event.data : {};
		if (data && data.type === 'init-messaging' && data.msid && !initialized) {
			// Import Firebase only when needed to avoid eval-time failures
			importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-app-compat.js');
			importScripts('https://www.gstatic.com/firebasejs/10.13.1/firebase-messaging-compat.js');
			firebase.initializeApp({ messagingSenderId: String(data.msid) });
			var messaging = firebase.messaging();
  messaging.onBackgroundMessage(function(payload) {
		var n = (payload && payload.notification) || {};
		var d = (payload && payload.data) || {};
		var title = n.title || d.title || 'Notification';
		var options = {
			body: n.body || d.body || '',
			icon: '/vite.svg',
			data: d
		};
				self.registration.showNotification(title, options);

		// Also forward the payload to any open clients (tabs) to show in-app toast
		try {
			self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
				clientList.forEach(function(client) {
					client.postMessage({ type: 'fcm-bg', payload: payload });
				});
			});
		} catch (e) {}
			});
			initialized = true;
		}
	} catch (e) {
		// swallow
	}
});

self.addEventListener('notificationclick', function(event) {
	event.notification.close();
	var data = event && event.notification && event.notification.data;
	var url = data && data.url;
	if (url) {
		event.waitUntil(clients.openWindow(url));
	}
});


