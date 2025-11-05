import admin from 'firebase-admin';

let initialized = false;

export const getFirebaseAdmin = () => {
	if (!initialized) {
		const projectId = process.env.FIREBASE_PROJECT_ID;
		const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
		let privateKey = process.env.FIREBASE_PRIVATE_KEY;
		if (privateKey && privateKey.includes('\\n')) {
			privateKey = privateKey.replace(/\\n/g, '\n');
		}

		if (!projectId || !clientEmail || !privateKey) {
			throw new Error('Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
		}

		admin.initializeApp({
			credential: admin.credential.cert({ projectId, clientEmail, privateKey })
		});
		initialized = true;
	}
	return admin;
};

export default getFirebaseAdmin;


