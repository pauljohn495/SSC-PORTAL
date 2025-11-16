import User from '../models/User.js';
import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import ActivityLog from '../models/ActivityLog.js';
import Notification from '../models/Notification.js';
import { logActivity } from '../utils/activityLogger.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { sendPushToAllUsers } from '../utils/push.js';
import { emitGlobal } from '../realtime/socket.js';
import { extractTextFromPDF } from '../utils/pdfExtractor.js';

// Helper function to create simplified log and set response header
const logAndSetHeader = (req, res, method, endpoint, status, responseData) => {
  // Extract content from various response structures
  let content = null;
  if (responseData?.content) {
    content = responseData.content;
  } else if (responseData?.handbook) {
    // Convert Mongoose document to plain object and exclude content field to avoid large headers and invalid characters
    const handbookObj = responseData.handbook.toObject ? responseData.handbook.toObject() : responseData.handbook;
    const { content: handbookContent, ...handbookWithoutContent } = handbookObj;
    content = handbookWithoutContent;
  } else if (responseData?.memorandum) {
    // Convert Mongoose document to plain object and exclude fileUrl to avoid large headers
    const memorandumObj = responseData.memorandum.toObject ? responseData.memorandum.toObject() : responseData.memorandum;
    const { fileUrl, ...memorandumWithoutFile } = memorandumObj;
    content = memorandumWithoutFile;
  } else if (responseData?.notification) {
    const notificationObj = responseData.notification.toObject ? responseData.notification.toObject() : responseData.notification;
    content = notificationObj;
  } else if (responseData?.logs) {
    content = responseData.logs;
  } else if (responseData?.notifications) {
    content = responseData.notifications;
  } else if (responseData?.events) {
    content = responseData.events;
  } else if (Array.isArray(responseData)) {
    content = responseData;
  }
  
  // Create simplified log data (without full response object)
  const logData = {
    method,
    endpoint,
    status,
    message: responseData?.message || null,
    content
  };
  
 
  try {
    // Safely stringify, handling circular references and other edge cases
    let headerValue;
    try {
      headerValue = JSON.stringify(logData);
    } catch (stringifyError) {
      // If stringify fails, create a simplified version
      headerValue = JSON.stringify({
        method: logData.method,
        endpoint: logData.endpoint,
        status: logData.status,
        message: logData.message || 'Response data could not be serialized'
      });
    }
    
    headerValue = headerValue.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
    
    // Replace tabs, newlines, and carriage returns with spaces
    headerValue = headerValue.replace(/[\r\n\t]/g, ' ');
    
    // Replace multiple spaces with single space
    headerValue = headerValue.replace(/\s+/g, ' ');
    
    // Trim the value
    headerValue = headerValue.trim();
    
    if (headerValue.length > 8000) {
      // If too large, simplify further
      const simplifiedLogData = {
        method: logData.method,
        endpoint: logData.endpoint,
        status: logData.status,
        message: logData.message || null,
        content: Array.isArray(content) ? `[Array of ${content.length} items]` : '[Content too large]'
      };
      headerValue = JSON.stringify(simplifiedLogData)
        .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Only set header if value is valid and not empty
    if (headerValue && headerValue.length > 0) {
      res.setHeader('X-API-Log', headerValue);
    }
  } catch (error) {
    // If header setting fails, just skip it (don't break the response)
    console.error('Failed to set X-API-Log header:', error);
  }
  
  return logData;
};

// Upload memorandum
export const uploadMemorandum = async (req, res, next) => {
  try {
    const { title, year, fileUrl, fileName, userId } = req.body;

    if (!userId) {
      const response = { message: 'User ID is required' };
      logAndSetHeader(req, res, 'POST', '/api/president/memorandums', 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findById(userId);
    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'POST', '/api/president/memorandums', 404, response);
      return res.status(404).json(response);
    }
    
    if (user.role !== 'president') {
      console.error(`User ${userId} (${user.email}) attempted to upload memorandum but has role: ${user.role}`);
      const response = { message: 'Only presidents can upload memorandum drafts' };
      logAndSetHeader(req, res, 'POST', '/api/president/memorandums', 403, response);
      return res.status(403).json(response);
    }

    // Extract text from PDF
    let pdfContent = '';
    try {
      pdfContent = await extractTextFromPDF(fileUrl);
    } catch (error) {
      console.error('Failed to extract PDF text:', error);
      // Continue even if extraction fails
    }

    const memorandum = new Memorandum({ 
      title, 
      year, 
      fileUrl, 
      fileName: fileName || '', 
      pdfContent,
      createdBy: userId 
    });
    await memorandum.save();

    await logActivity(userId, 'memorandum_upload', `Memorandum "${title}" uploaded`, { 
      memorandumId: memorandum._id, 
      title, 
      year 
    }, req);

    // Create response without fileUrl to avoid large payloads
    const memorandumResponse = {
      _id: memorandum._id,
      title: memorandum.title,
      year: memorandum.year,
      status: memorandum.status,
      createdBy: memorandum.createdBy,
      createdAt: memorandum.createdAt,
      updatedAt: memorandum.updatedAt,
      version: memorandum.version
      // Exclude fileUrl as it's too large for response
    };

    const response = { message: 'Memorandum draft uploaded', memorandum: memorandumResponse };
    logAndSetHeader(req, res, 'POST', '/api/president/memorandums', 201, response);
    res.status(201).json(response);
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
      const response = { message: 'Only presidents can set edit priority' };
      logAndSetHeader(req, res, 'POST', `/api/president/memorandums/${id}/priority`, 403, response);
      return res.status(403).json(response);
    }

    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      const response = { message: 'Memorandum not found' };
      logAndSetHeader(req, res, 'POST', `/api/president/memorandums/${id}/priority`, 404, response);
      return res.status(404).json(response);
    }

    if (!memorandum.priorityEditor) {
      memorandum.priorityEditor = userId;
      memorandum.priorityEditStartedAt = new Date();
      await memorandum.save();
      
      const response = { 
        message: 'You have edit priority', 
        memorandum,
        hasPriority: true
      };
      logAndSetHeader(req, res, 'POST', `/api/president/memorandums/${id}/priority`, 200, response);
      res.status(200).json(response);
    } else {
      const priorityUser = await User.findById(memorandum.priorityEditor);
      const response = { 
        message: 'Another user has edit priority', 
        memorandum,
        hasPriority: false,
        priorityEditor: priorityUser ? priorityUser.name : 'Unknown',
        priorityEditStartedAt: memorandum.priorityEditStartedAt
      };
      logAndSetHeader(req, res, 'POST', `/api/president/memorandums/${id}/priority`, 200, response);
      res.status(200).json(response);
    }
  } catch (error) {
    next(error);
  }
};

// Update memorandum
export const updateMemorandum = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, year, fileUrl, fileName, userId, version } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      const response = { message: 'Only presidents can update memorandum drafts' };
      logAndSetHeader(req, res, 'PUT', `/api/president/memorandums/${id}`, 403, response);
      return res.status(403).json(response);
    }

    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      const response = { message: 'Memorandum not found' };
      logAndSetHeader(req, res, 'PUT', `/api/president/memorandums/${id}`, 404, response);
      return res.status(404).json(response);
    }

    if (!memorandum.priorityEditor || memorandum.priorityEditor.toString() !== userId) {
      const response = { 
        message: 'You do not have edit priority. Only the first user to click edit can save changes.',
        hasPriority: false
      };
      logAndSetHeader(req, res, 'PUT', `/api/president/memorandums/${id}`, 409, response);
      return res.status(409).json(response);
    }

    if (memorandum.version !== version) {
      const response = { message: 'Document has been modified. Please refresh and try again.' };
      logAndSetHeader(req, res, 'PUT', `/api/president/memorandums/${id}`, 409, response);
      return res.status(409).json(response);
    }

    const oldFileUrl = memorandum.fileUrl;
    memorandum.title = title;
    memorandum.year = year;
    memorandum.fileUrl = fileUrl;
    if (fileName !== undefined) {
      memorandum.fileName = fileName || '';
    }
    
    // Extract text from PDF if a new file was uploaded
    if (fileUrl && fileUrl !== oldFileUrl) {
      try {
        memorandum.pdfContent = await extractTextFromPDF(fileUrl);
      } catch (error) {
        console.error('Failed to extract PDF text:', error);
        // Keep existing content if extraction fails
      }
    }
    
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

    // Create response without fileUrl to avoid large payloads
    const memorandumResponse = {
      _id: memorandum._id,
      title: memorandum.title,
      year: memorandum.year,
      status: memorandum.status,
      createdBy: memorandum.createdBy,
      editedBy: memorandum.editedBy,
      editedAt: memorandum.editedAt,
      createdAt: memorandum.createdAt,
      updatedAt: memorandum.updatedAt,
      version: memorandum.version
      // Exclude fileUrl as it's too large for response
    };

    const response = { message: 'Memorandum updated successfully', memorandum: memorandumResponse };
    logAndSetHeader(req, res, 'PUT', `/api/president/memorandums/${id}`, 200, response);
    res.status(200).json(response);
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
      const response = { message: 'Only presidents can clear edit priority' };
      logAndSetHeader(req, res, 'POST', `/api/president/memorandums/${id}/clear-priority`, 403, response);
      return res.status(403).json(response);
    }

    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      const response = { message: 'Memorandum not found' };
      logAndSetHeader(req, res, 'POST', `/api/president/memorandums/${id}/clear-priority`, 404, response);
      return res.status(404).json(response);
    }

    if (memorandum.priorityEditor && memorandum.priorityEditor.toString() === userId) {
      memorandum.priorityEditor = null;
      memorandum.priorityEditStartedAt = null;
      await memorandum.save();
    }

    const response = { message: 'Priority cleared' };
    logAndSetHeader(req, res, 'POST', `/api/president/memorandums/${id}/clear-priority`, 200, response);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Create handbook page
export const createHandbook = async (req, res, next) => {
  try {
    const { content, userId } = req.body;

    if (!userId) {
      const response = { message: 'User ID is required' };
      logAndSetHeader(req, res, 'POST', '/api/president/handbook', 400, response);
      return res.status(400).json(response);
    }

    if (!content) {
      const response = { message: 'Content is required' };
      logAndSetHeader(req, res, 'POST', '/api/president/handbook', 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findById(userId);
    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'POST', '/api/president/handbook', 404, response);
      return res.status(404).json(response);
    }
    
    if (user.role !== 'president') {
      console.error(`User ${userId} (${user.email}) attempted to create handbook but has role: ${user.role}`);
      const response = { message: 'Only presidents can create handbook drafts' };
      logAndSetHeader(req, res, 'POST', '/api/president/handbook', 403, response);
      return res.status(403).json(response);
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

    const response = { message: 'Handbook draft created', handbook };
    logAndSetHeader(req, res, 'POST', '/api/president/handbook', 201, response);
    res.status(201).json(response);
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
      const response = { message: 'Only presidents can set edit priority' };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook/${id}/priority`, 403, response);
      return res.status(403).json(response);
    }

    const handbook = await Handbook.findById(id);
    if (!handbook) {
      const response = { message: 'Handbook not found' };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook/${id}/priority`, 404, response);
      return res.status(404).json(response);
    }

    if (!handbook.priorityEditor) {
      handbook.priorityEditor = userId;
      handbook.priorityEditStartedAt = new Date();
      await handbook.save();
      
      const response = { 
        message: 'You have edit priority', 
        handbook,
        hasPriority: true
      };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook/${id}/priority`, 200, response);
      res.status(200).json(response);
    } else {
      const priorityUser = await User.findById(handbook.priorityEditor);
      const response = { 
        message: 'Another user has edit priority', 
        handbook,
        hasPriority: false,
        priorityEditor: priorityUser ? priorityUser.name : 'Unknown',
        priorityEditStartedAt: handbook.priorityEditStartedAt
      };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook/${id}/priority`, 200, response);
      res.status(200).json(response);
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
      const response = { message: 'Content is required' };
      logAndSetHeader(req, res, 'PUT', `/api/president/handbook/${id}`, 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      const response = { message: 'Only presidents can update handbook drafts' };
      logAndSetHeader(req, res, 'PUT', `/api/president/handbook/${id}`, 403, response);
      return res.status(403).json(response);
    }

    const handbook = await Handbook.findById(id);
    if (!handbook) {
      const response = { message: 'Handbook not found' };
      logAndSetHeader(req, res, 'PUT', `/api/president/handbook/${id}`, 404, response);
      return res.status(404).json(response);
    }

    if (!handbook.priorityEditor || handbook.priorityEditor.toString() !== userId) {
      const response = { 
        message: 'You do not have edit priority. Only the first user to click edit can save changes.',
        hasPriority: false
      };
      logAndSetHeader(req, res, 'PUT', `/api/president/handbook/${id}`, 409, response);
      return res.status(409).json(response);
    }

    if (handbook.version !== version) {
      const response = { message: 'Document has been modified. Please refresh and try again.' };
      logAndSetHeader(req, res, 'PUT', `/api/president/handbook/${id}`, 409, response);
      return res.status(409).json(response);
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

    const response = { message: 'Handbook updated successfully', handbook };
    logAndSetHeader(req, res, 'PUT', `/api/president/handbook/${id}`, 200, response);
    res.status(200).json(response);
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
      const response = { message: 'Only presidents can clear edit priority' };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook/${id}/clear-priority`, 403, response);
      return res.status(403).json(response);
    }

    const handbook = await Handbook.findById(id);
    if (!handbook) {
      const response = { message: 'Handbook not found' };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook/${id}/clear-priority`, 404, response);
      return res.status(404).json(response);
    }

    if (handbook.priorityEditor && handbook.priorityEditor.toString() === userId) {
      handbook.priorityEditor = null;
      handbook.priorityEditStartedAt = null;
      await handbook.save();
    }

    const response = { message: 'Priority cleared' };
    logAndSetHeader(req, res, 'POST', `/api/president/handbook/${id}/clear-priority`, 200, response);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Get user-specific activity logs
export const getUserActivityLogs = async (req, res, next) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      const response = { message: 'User ID is required' };
      logAndSetHeader(req, res, 'GET', '/api/president/activity-logs', 400, response);
      return res.status(400).json(response);
    }

    const logs = await ActivityLog.find({ user: userId })
      .populate('user', 'name email role')
      .sort({ timestamp: -1 })
      .limit(500);
    const response = logs;
    logAndSetHeader(req, res, 'GET', '/api/president/activity-logs', 200, { logs: response, count: response.length });
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Create notification (only president)
export const createNotification = async (req, res, next) => {
  try {
    const { title, message, userId } = req.body;

    if (!userId) {
      const response = { message: 'User ID is required' };
      logAndSetHeader(req, res, 'POST', '/api/president/notifications', 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findById(userId);
    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'POST', '/api/president/notifications', 404, response);
      return res.status(404).json(response);
    }
    
    if (user.role !== 'president') {
      console.error(`User ${userId} (${user.email}) attempted to create notification but has role: ${user.role}`);
      const response = { message: 'Only presidents can create notifications' };
      logAndSetHeader(req, res, 'POST', '/api/president/notifications', 403, response);
      return res.status(403).json(response);
    }

    if (!title || !message) {
      const response = { message: 'Title and message are required' };
      logAndSetHeader(req, res, 'POST', '/api/president/notifications', 400, response);
      return res.status(400).json(response);
    }

    const notification = new Notification({ title, message, createdBy: userId });
    await notification.save();

    await logActivity(userId, 'notification_create', `Notification "${title}" created`, { 
      notificationId: notification._id, 
      title 
    }, req);

    const response = { message: 'Notification created successfully', notification };
    logAndSetHeader(req, res, 'POST', '/api/president/notifications', 201, response);
    res.status(201).json(response);
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
      const response = { message: 'Only presidents can publish notifications' };
      logAndSetHeader(req, res, 'POST', `/api/president/notifications/${id}/publish`, 403, response);
      return res.status(403).json(response);
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      const response = { message: 'Notification not found' };
      logAndSetHeader(req, res, 'POST', `/api/president/notifications/${id}/publish`, 404, response);
      return res.status(404).json(response);
    }

    if (notification.published) {
      const response = { message: 'Notification is already published' };
      logAndSetHeader(req, res, 'POST', `/api/president/notifications/${id}/publish`, 400, response);
      return res.status(400).json(response);
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

    // Send push to all users 
    try {
      await sendPushToAllUsers(notification.title, notification.message);
    } catch (pushErr) {
      console.error('Error sending push notifications:', pushErr);
    }

    // REAL TIME POPUP NOTIFICATION
    try {
      emitGlobal('notification:published', { id: notification._id, title: notification.title, message: notification.message, publishedAt: notification.publishedAt });
    } catch (e) {}

    await logActivity(userId, 'notification_publish', `Notification "${notification.title}" published`, { 
      notificationId: notification._id, 
      title: notification.title 
    }, req);

    const response = { message: 'Notification published and emails sent', notification };
    logAndSetHeader(req, res, 'POST', `/api/president/notifications/${id}/publish`, 200, response);
    res.status(200).json(response);
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
    
    const response = notifications;
    logAndSetHeader(req, res, 'GET', '/api/president/notifications', 200, { 
      message: `Fetched ${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`,
      notifications: response, 
      count: response.length 
    });
    res.json(response);
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
      const response = { message: 'Only presidents can delete notifications' };
      logAndSetHeader(req, res, 'DELETE', `/api/president/notifications/${id}`, 403, response);
      return res.status(403).json(response);
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      const response = { message: 'Notification not found' };
      logAndSetHeader(req, res, 'DELETE', `/api/president/notifications/${id}`, 404, response);
      return res.status(404).json(response);
    }

    await Notification.findByIdAndDelete(id);

    await logActivity(userId, 'notification_delete', `Notification "${notification.title}" deleted`, { 
      notificationId: id, 
      title: notification.title 
    }, req);

    const response = { message: 'Notification deleted successfully' };
    logAndSetHeader(req, res, 'DELETE', `/api/president/notifications/${id}`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

