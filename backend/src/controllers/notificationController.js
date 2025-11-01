import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { logActivity } from '../utils/activityLogger.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

// Create notification (President only)
export const createNotification = async (req, res, next) => {
  try {
    const { title, message, userId } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can create notifications' });
    }

    const notification = new Notification({
      title,
      message,
      createdBy: userId
    });

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

// Publish notification (President only)
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

    notification.isPublished = true;
    notification.publishedAt = new Date();
    await notification.save();

    await logActivity(userId, 'notification_publish', `Notification "${notification.title}" published`, {
      notificationId: id,
      title: notification.title
    }, req);

    // Send email to all users
    try {
      const users = await User.find({ email: { $exists: true, $ne: '' } });
      const emails = users.map(u => u.email).filter(email => email);

      if (emails.length > 0) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: config.email.user || 'your-email@gmail.com',
            pass: config.email.pass || 'your-app-password'
          }
        });

        const mailOptions = {
          from: config.email.user || 'your-email@gmail.com',
          bcc: emails, // Use BCC to send to multiple recipients
          subject: `New Notification: ${notification.title} - BUKSU - SSC`,
          html: `
            <h2>${notification.title}</h2>
            <p>${notification.message}</p>
            <p><em>Published by BUKSU Supreme Student Council</em></p>
          `
        };

        await transporter.sendMail(mailOptions);
        console.log(`Notification email sent to ${emails.length} users`);
      }
    } catch (emailError) {
      console.error('Error sending notification emails:', emailError);
      // Don't fail the request if email fails
    }

    res.json({ message: 'Notification published successfully', notification });
  } catch (error) {
    next(error);
  }
};

// Get all notifications (published first)
export const getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find()
      .populate('createdBy', 'name email role')
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(50);
    
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

// Get notification by ID
export const getNotificationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findById(id)
      .populate('createdBy', 'name email role');
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json(notification);
  } catch (error) {
    next(error);
  }
};

// Delete notification (President only)
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

