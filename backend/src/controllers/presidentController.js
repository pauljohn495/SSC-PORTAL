import User from '../models/User.js';
import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import ActivityLog from '../models/ActivityLog.js';
import Notification from '../models/Notification.js';
import { logActivity } from '../utils/activityLogger.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { sendPushToAllUsers } from '../utils/push.js';

// Upload memorandum
export const uploadMemorandum = async (req, res, next) => {
  try {
    const { title, year, fileUrl, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.role !== 'president') {
      console.error(`User ${userId} (${user.email}) attempted to upload memorandum but has role: ${user.role}`);
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
    const { content, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.role !== 'president') {
      console.error(`User ${userId} (${user.email}) attempted to create handbook but has role: ${user.role}`);
      return res.status(403).json({ message: 'Only presidents can create handbook drafts' });
    }

    // Get the next page number (count existing approved/draft handbooks + 1)
    const existingHandbooksCount = await Handbook.countDocuments();
    const pageNumber = existingHandbooksCount + 1;

    const handbook = new Handbook({ content, pageNumber, createdBy: userId });
    await handbook.save();

    await logActivity(userId, 'handbook_create', `Handbook page ${pageNumber} created`, { 
      handbookId: handbook._id, 
      pageNumber 
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
    const { content, userId, version } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

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

    handbook.content = content;
    handbook.status = 'draft';
    handbook.updatedAt = Date.now();
    handbook.version = handbook.version + 1;
    handbook.editedBy = userId;
    handbook.editedAt = new Date();
    handbook.priorityEditor = null;
    handbook.priorityEditStartedAt = null;
    await handbook.save();

    await logActivity(userId, 'handbook_update', `Handbook page ${handbook.pageNumber} updated`, { 
      handbookId: id, 
      pageNumber: handbook.pageNumber 
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

// Create notification (only president)
export const createNotification = async (req, res, next) => {
  try {
    const { title, message, userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    if (user.role !== 'president') {
      console.error(`User ${userId} (${user.email}) attempted to create notification but has role: ${user.role}`);
      return res.status(403).json({ message: 'Only presidents can create notifications' });
    }

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const notification = new Notification({ title, message, createdBy: userId });
    await notification.save();

    await logActivity(userId, 'notification_create', `Notification "${title}" created`, { 
      notificationId: notification._id, 
      title 
    }, req);

    res.status(201).json({ message: 'Notification created successfully', notification });
  } catch (error) {
    next(error);
  }
};

// Publish notification and send email to all users (only president)
export const publishNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can publish notifications' });
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notification.published) {
      return res.status(400).json({ message: 'Notification is already published' });
    }

    // Mark as published
    notification.published = true;
    notification.publishedAt = new Date();
    await notification.save();

    // Send email to all users
    try {
      const allUsers = await User.find({ email: { $exists: true, $ne: null } });
      
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.email.user || 'your-email@gmail.com',
          pass: config.email.pass || 'your-app-password'
        }
      });

      const emailPromises = allUsers.map(async (user) => {
        if (user.email) {
          try {
            await transporter.sendMail({
              from: config.email.user || 'your-email@gmail.com',
              to: user.email,
              subject: `[BUKSU SSC] ${notification.title}`,
              html: `
                <h2>${notification.title}</h2>
                <p>${notification.message.replace(/\n/g, '<br>')}</p>
                <hr>
                <p style="color: #666; font-size: 12px;">This is an automated notification from BUKSU Supreme Student Council Portal.</p>
              `
            });
          } catch (emailError) {
            console.error(`Failed to send email to ${user.email}:`, emailError);
          }
        }
      });

      await Promise.all(emailPromises);
      notification.emailSent = true;
      await notification.save();
    } catch (emailError) {
      console.error('Error sending notification emails:', emailError);
      // Continue even if email fails
    }

    // Send push to all users (best-effort)
    try {
      await sendPushToAllUsers(notification.title, notification.message);
    } catch (pushErr) {
      console.error('Error sending push notifications:', pushErr);
    }

    await logActivity(userId, 'notification_publish', `Notification "${notification.title}" published`, { 
      notificationId: notification._id, 
      title: notification.title 
    }, req);

    res.status(200).json({ message: 'Notification published and emails sent', notification });
  } catch (error) {
    next(error);
  }
};

// Get all notifications (published first, then unpublished)
export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find()
      .populate('createdBy', 'name email')
      .sort({ published: -1, publishedAt: -1, createdAt: -1 });
    
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

// Delete notification (only president)
export const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can delete notifications' });
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await Notification.findByIdAndDelete(id);

    await logActivity(userId, 'notification_delete', `Notification "${notification.title}" deleted`, { 
      notificationId: id, 
      title: notification.title 
    }, req);

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    next(error);
  }
};

