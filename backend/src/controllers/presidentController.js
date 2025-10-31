import User from '../models/User.js';
import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import ActivityLog from '../models/ActivityLog.js';
import { logActivity } from '../utils/activityLogger.js';

// Upload memorandum
export const uploadMemorandum = async (req, res, next) => {
  try {
    const { title, year, fileUrl, userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can upload memorandum drafts' });
    }

    const memorandum = new Memorandum({ title, year, fileUrl, createdBy: userId });
    await memorandum.save();

    await logActivity(userId, 'memorandum_upload', `Memorandum "${title}" uploaded`, { 
      memorandumId: memorandum._id, 
      title, 
      year 
    }, req);

    res.status(201).json({ message: 'Memorandum draft uploaded', memorandum });
  } catch (error) {
    next(error);
  }
};

// Set priority editor for memorandum
export const setMemorandumPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can set edit priority' });
    }

    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    if (!memorandum.priorityEditor) {
      memorandum.priorityEditor = userId;
      memorandum.priorityEditStartedAt = new Date();
      await memorandum.save();
      
      res.status(200).json({ 
        message: 'You have edit priority', 
        memorandum,
        hasPriority: true
      });
    } else {
      const priorityUser = await User.findById(memorandum.priorityEditor);
      res.status(200).json({ 
        message: 'Another user has edit priority', 
        memorandum,
        hasPriority: false,
        priorityEditor: priorityUser ? priorityUser.name : 'Unknown',
        priorityEditStartedAt: memorandum.priorityEditStartedAt
      });
    }
  } catch (error) {
    next(error);
  }
};

// Update memorandum
export const updateMemorandum = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, year, fileUrl, userId, version } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can update memorandum drafts' });
    }

    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    if (!memorandum.priorityEditor || memorandum.priorityEditor.toString() !== userId) {
      return res.status(409).json({ 
        message: 'You do not have edit priority. Only the first user to click edit can save changes.',
        hasPriority: false
      });
    }

    if (memorandum.version !== version) {
      return res.status(409).json({ message: 'Document has been modified. Please refresh and try again.' });
    }

    memorandum.title = title;
    memorandum.year = year;
    memorandum.fileUrl = fileUrl;
    memorandum.status = 'draft';
    memorandum.version = memorandum.version + 1;
    memorandum.editedBy = userId;
    memorandum.editedAt = new Date();
    memorandum.priorityEditor = null;
    memorandum.priorityEditStartedAt = null;
    await memorandum.save();

    await logActivity(userId, 'memorandum_update', `Memorandum "${memorandum.title}" updated`, { 
      memorandumId: id, 
      title: memorandum.title, 
      year: memorandum.year 
    }, req);

    res.status(200).json({ message: 'Memorandum updated successfully', memorandum });
  } catch (error) {
    next(error);
  }
};

// Clear priority editor for memorandum
export const clearMemorandumPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can clear edit priority' });
    }

    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    if (memorandum.priorityEditor && memorandum.priorityEditor.toString() === userId) {
      memorandum.priorityEditor = null;
      memorandum.priorityEditStartedAt = null;
      await memorandum.save();
    }

    res.status(200).json({ message: 'Priority cleared' });
  } catch (error) {
    next(error);
  }
};

// Create handbook page
export const createHandbook = async (req, res, next) => {
  try {
    const { title, content, userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can create handbook drafts' });
    }

    const handbook = new Handbook({ title, content, createdBy: userId });
    await handbook.save();

    await logActivity(userId, 'handbook_create', `Handbook page "${title}" created`, { 
      handbookId: handbook._id, 
      title 
    }, req);

    res.status(201).json({ message: 'Handbook draft created', handbook });
  } catch (error) {
    next(error);
  }
};

// Set priority editor for handbook
export const setHandbookPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can set edit priority' });
    }

    const handbook = await Handbook.findById(id);
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    if (!handbook.priorityEditor) {
      handbook.priorityEditor = userId;
      handbook.priorityEditStartedAt = new Date();
      await handbook.save();
      
      res.status(200).json({ 
        message: 'You have edit priority', 
        handbook,
        hasPriority: true
      });
    } else {
      const priorityUser = await User.findById(handbook.priorityEditor);
      res.status(200).json({ 
        message: 'Another user has edit priority', 
        handbook,
        hasPriority: false,
        priorityEditor: priorityUser ? priorityUser.name : 'Unknown',
        priorityEditStartedAt: handbook.priorityEditStartedAt
      });
    }
  } catch (error) {
    next(error);
  }
};

// Update handbook page
export const updateHandbook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, userId, version } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can update handbook drafts' });
    }

    const handbook = await Handbook.findById(id);
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    if (!handbook.priorityEditor || handbook.priorityEditor.toString() !== userId) {
      return res.status(409).json({ 
        message: 'You do not have edit priority. Only the first user to click edit can save changes.',
        hasPriority: false
      });
    }

    if (handbook.version !== version) {
      return res.status(409).json({ message: 'Document has been modified. Please refresh and try again.' });
    }

    handbook.title = title;
    handbook.content = content;
    handbook.status = 'draft';
    handbook.updatedAt = Date.now();
    handbook.version = handbook.version + 1;
    handbook.editedBy = userId;
    handbook.editedAt = new Date();
    handbook.priorityEditor = null;
    handbook.priorityEditStartedAt = null;
    await handbook.save();

    await logActivity(userId, 'handbook_update', `Handbook page "${handbook.title}" updated`, { 
      handbookId: id, 
      title: handbook.title 
    }, req);

    res.status(200).json({ message: 'Handbook updated successfully', handbook });
  } catch (error) {
    next(error);
  }
};

// Clear priority editor for handbook
export const clearHandbookPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can clear edit priority' });
    }

    const handbook = await Handbook.findById(id);
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    if (handbook.priorityEditor && handbook.priorityEditor.toString() === userId) {
      handbook.priorityEditor = null;
      handbook.priorityEditStartedAt = null;
      await handbook.save();
    }

    res.status(200).json({ message: 'Priority cleared' });
  } catch (error) {
    next(error);
  }
};

// Get user-specific activity logs
export const getUserActivityLogs = async (req, res, next) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const logs = await ActivityLog.find({ user: userId })
      .populate('user', 'name email role')
      .sort({ timestamp: -1 })
      .limit(500);
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

