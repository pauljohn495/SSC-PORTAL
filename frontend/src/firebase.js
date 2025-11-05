import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

let messagingPromise = null;

export const getMessagingIfSupported = async () => {
	if (!messagingPromise) {
		messagingPromise = (await isSupported()) ? getMessaging(app) : null;
	}
	return messagingPromise;
};

export const requestFcmToken = async (serviceWorkerRegistration) => {
	try {
		const messaging = await getMessagingIfSupported();
		if (!messaging) return null;
		const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
		if (!vapidKey) {
			console.warn('VAPID key missing (VITE_FIREBASE_VAPID_KEY)');
			return null;
		}
		const token = await getToken(messaging, { 
			vapidKey,
			serviceWorkerRegistration: serviceWorkerRegistration || undefined,
		});
		return token || null;
	} catch (err) {
		console.error('FCM getToken error:', err);
		return null;
	}
};

export const subscribeOnMessage = async (handler) => {
	const messaging = await getMessagingIfSupported();
	if (!messaging) return () => {};
	return onMessage(messaging, handler);
};

export default app;


