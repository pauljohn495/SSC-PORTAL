import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import Notification from '../models/Notification.js';

// Get all approved handbooks
export const getPublicHandbooks = async (req, res, next) => {
  try {
    const handbooks = await Handbook.find({ status: 'approved' }).sort({ createdAt: -1 });
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

