import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import Notification from '../models/Notification.js';
import { getFirebaseAdmin } from '../config/firebaseAdmin.js';
import User from '../models/User.js';

// Get all approved handbooks
export const getPublicHandbooks = async (req, res, next) => {
  try {
    const handbooks = await Handbook.find({ status: 'approved' }).sort({ pageNumber: 1 });
    res.json(handbooks);
  } catch (error) {
    next(error);
  }
};

// Get all approved memorandums
export const getPublicMemorandums = async (req, res, next) => {
  try {
    const memorandums = await Memorandum.find({ status: 'approved' }).sort({ uploadedAt: -1 });
    res.json(memorandums);
  } catch (error) {
    next(error);
  }
};

// Get all published notifications
export const getPublicNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ published: true })
      .populate('createdBy', 'name email')
      .sort({ publishedAt: -1 });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

// Send a test push notification to a user by userId
export const sendTestPush = async (req, res, next) => {
  try {
    const { userId, title, body } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const user = await User.findById(userId);
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      return res.status(404).json({ message: 'User has no registered FCM tokens' });
    }

    const admin = getFirebaseAdmin();
    const message = {
      data: { title: String(title || 'Test notification'), body: String(body || 'Hello from server') },
      tokens: user.fcmTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.json({ successCount: response.successCount, failureCount: response.failureCount, responses: response.responses });
  } catch (error) {
    next(error);
  }
};

