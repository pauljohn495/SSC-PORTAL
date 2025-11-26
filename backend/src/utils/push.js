import User from '../models/User.js';
import { getFirebaseAdmin } from '../config/firebaseAdmin.js';

export const sendPushToAllUsers = async (title, body, userFilter = {}) => {
	const query = {
		fcmTokens: { $exists: true, $ne: [] },
		...userFilter,
	};
	const users = await User.find(query, { fcmTokens: 1 });
	const tokens = users.flatMap(u => Array.isArray(u.fcmTokens) ? u.fcmTokens : []);
	if (tokens.length === 0) return { successCount: 0, failureCount: 0 };
	const admin = getFirebaseAdmin();
	const chunks = [];
	const size = 500;
	for (let i = 0; i < tokens.length; i += size) chunks.push(tokens.slice(i, i + size));
	let totalSuccess = 0;
	let totalFailure = 0;
	for (const batch of chunks) {
		const resp = await admin.messaging().sendEachForMulticast({ 
			data: { title: String(title || ''), body: String(body || '') },
			tokens: batch 
		});
		totalSuccess += resp.successCount;
		totalFailure += resp.failureCount;
	}
	return { successCount: totalSuccess, failureCount: totalFailure };
};


