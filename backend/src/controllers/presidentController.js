import User from '../models/User.js';
import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import ActivityLog from '../models/ActivityLog.js';
import Notification from '../models/Notification.js';
import HandbookSection from '../models/HandbookSection.js';
import { logActivity } from '../utils/activityLogger.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { sendPushToAllUsers } from '../utils/push.js';
import { emitGlobal } from '../realtime/socket.js';
import { extractTextFromPDF } from '../utils/pdfExtractor.js';
import { google } from 'googleapis';
import { getDepartments } from '../data/departments.js';

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

// Helper function to get OAuth2 client for Google Drive
// Uses a different redirect URI to distinguish from Calendar OAuth
const getDriveOAuth2Client = (tokens) => {
  // Construct Drive-specific redirect URI
  // If redirectUri is like http://localhost:5001/api/president/calendar/oauth/callback
  // Change it to http://localhost:5001/api/president/drive/oauth/callback
  let driveRedirectUri = config.google.redirectUri;
  if (driveRedirectUri.includes('/calendar/oauth/callback')) {
    driveRedirectUri = driveRedirectUri.replace('/calendar/oauth/callback', '/drive/oauth/callback');
  } else if (driveRedirectUri.includes('/oauth/callback')) {
    // If it's a generic callback, replace with drive-specific
    driveRedirectUri = driveRedirectUri.replace('/oauth/callback', '/drive/oauth/callback');
  } else {
    // Fallback: append drive path
    const baseUrl = driveRedirectUri.split('/oauth')[0] || driveRedirectUri;
    driveRedirectUri = `${baseUrl}/drive/oauth/callback`;
  }
  
  const oAuth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    driveRedirectUri
  );
  if (tokens) {
    oAuth2Client.setCredentials(tokens);
  }
  return oAuth2Client;
};

// Get Google Drive OAuth authorization URL
export const getDriveAuthUrl = async (req, res, next) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      const response = { message: 'User ID is required' };
      logAndSetHeader(req, res, 'GET', '/api/president/drive/auth-url', 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findById(userId);
    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'GET', '/api/president/drive/auth-url', 404, response);
      return res.status(404).json(response);
    }

    if (user.role !== 'president') {
      const response = { message: 'Only presidents can connect Google Drive' };
      logAndSetHeader(req, res, 'GET', '/api/president/drive/auth-url', 403, response);
      return res.status(403).json(response);
    }

    const oAuth2Client = getDriveOAuth2Client();
    const scopes = [
      'https://www.googleapis.com/auth/drive.file', // Access to files created by this app
    ];
    const state = encodeURIComponent(JSON.stringify({ userId }));
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state
    });

    const response = { url: authUrl };
    logAndSetHeader(req, res, 'GET', '/api/president/drive/auth-url', 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Handle Google Drive OAuth callback
export const driveOAuthCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const { userId } = JSON.parse(decodeURIComponent(state || '{}'));
    
    const user = await User.findById(userId);
    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'GET', '/api/president/drive/oauth/callback', 404, response);
      return res.status(404).send(response.message);
    }

    if (user.role !== 'president') {
      const response = { message: 'Forbidden' };
      logAndSetHeader(req, res, 'GET', '/api/president/drive/oauth/callback', 403, response);
      return res.status(403).send(response.message);
    }

    const oAuth2Client = getDriveOAuth2Client();
    const { tokens } = await oAuth2Client.getToken(code);

    user.googleDrive = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || user.googleDrive?.refreshToken,
      scope: tokens.scope,
      tokenType: tokens.token_type,
      expiryDate: tokens.expiry_date
    };
    await user.save();

    const response = { message: 'Google Drive connected successfully! You can close this window.' };
    logAndSetHeader(req, res, 'GET', '/api/president/drive/oauth/callback', 200, response);
    res.send(
      `<html>
        <body>
          <h2>${response.message}</h2>
          <script>
            (function() {
              try {
                if (window.opener && typeof window.opener.postMessage === 'function') {
                  window.opener.postMessage('google-drive-connected', '*');
                }
              } catch (err) {
                console.error('Failed to notify opener about Drive connection:', err);
              }
              setTimeout(function() { window.close(); }, 2000);
            })();
          </script>
        </body>
      </html>`
    );
  } catch (error) {
    const response = { message: `OAuth error: ${error.message}` };
    logAndSetHeader(req, res, 'GET', '/api/president/drive/oauth/callback', 400, response);
    res.status(400).send(response.message);
  }
};

export const getDriveConnectionStatus = async (req, res, next) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      const response = { message: 'User ID is required' };
      logAndSetHeader(req, res, 'GET', '/api/president/drive/status', 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findById(userId);
    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'GET', '/api/president/drive/status', 404, response);
      return res.status(404).json(response);
    }

    if (user.role !== 'president') {
      const response = { message: 'Forbidden' };
      logAndSetHeader(req, res, 'GET', '/api/president/drive/status', 403, response);
      return res.status(403).json(response);
    }

    const connected = Boolean(user.googleDrive?.refreshToken || user.googleDrive?.accessToken);
    const response = { connected };
    logAndSetHeader(req, res, 'GET', '/api/president/drive/status', 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
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
    const { fileUrl, fileName, userId } = req.body;

    if (!userId) {
      const response = { message: 'User ID is required' };
      logAndSetHeader(req, res, 'POST', '/api/president/handbook', 400, response);
      return res.status(400).json(response);
    }

    if (!fileUrl) {
      const response = { message: 'PDF file is required' };
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

    // Check if there's already an approved handbook - delete old ones first
    const existingApproved = await Handbook.find({ status: 'approved' });
    if (existingApproved.length > 0) {
      // Delete old Google Drive files (handle errors gracefully)
      const { deleteFileFromDrive } = await import('../utils/googleDrive.js');
      for (const oldHandbook of existingApproved) {
        if (oldHandbook.googleDriveFileId) {
          try {
            await deleteFileFromDrive(oldHandbook.googleDriveFileId, userId);
          } catch (error) {
            // Log but continue - file might not exist or deletion might fail
            console.warn(`Could not delete Google Drive file ${oldHandbook.googleDriveFileId}:`, error.message);
          }
        }
        // Also handle old file system files for backward compatibility
        if (oldHandbook.fileUrl && !oldHandbook.fileUrl.startsWith('data:') && !oldHandbook.fileUrl.startsWith('http')) {
          try {
            const { deletePDFFile } = await import('../utils/fileStorage.js');
            deletePDFFile(oldHandbook.fileUrl);
          } catch (error) {
            // Log but continue - file might not exist
            console.warn(`Could not delete file system file ${oldHandbook.fileUrl}:`, error.message);
          }
        }
      }
      // Delete old handbook entries
      await Handbook.deleteMany({ status: 'approved' });
    }

    // Convert base64 to buffer
    let base64Content = fileUrl;
    if (fileUrl.includes(',')) {
      base64Content = fileUrl.split(',')[1];
    }
    const pdfBuffer = Buffer.from(base64Content, 'base64');

    // Upload whole PDF to Google Drive
    const { uploadPDFToDrive, extractTextFromPDFBuffer } = await import('../utils/googleDrive.js');
    const { config } = await import('../config/index.js');
    
    const sanitizedFileName = (fileName || 'handbook.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');
    const driveFolderId = config.google.driveFolderId || null;
    
    console.log('Uploading PDF to Google Drive...');
    const driveResult = await uploadPDFToDrive(pdfBuffer, sanitizedFileName, userId, driveFolderId);
    
    // Extract text content from PDF for search indexing
    console.log('Extracting text from PDF for search...');
    const pdfContent = await extractTextFromPDFBuffer(pdfBuffer);
    
    // Create single Handbook entry for the whole PDF
    const handbook = new Handbook({
      fileName: sanitizedFileName,
      googleDriveFileId: driveResult.fileId,
      googleDrivePreviewUrl: driveResult.previewUrl,
      pdfContent: pdfContent,
      createdBy: userId
    });
    await handbook.save();

    await logActivity(userId, 'handbook_create', `Handbook created and uploaded to Google Drive: ${sanitizedFileName}`, { 
      fileName: sanitizedFileName,
      googleDriveFileId: driveResult.fileId
    }, req);

    // Return summary
    const response = { 
      message: 'Handbook draft created and uploaded to Google Drive', 
      handbook: {
        _id: handbook._id,
        fileName: handbook.fileName,
        googleDriveFileId: handbook.googleDriveFileId,
        googleDrivePreviewUrl: handbook.googleDrivePreviewUrl,
        status: handbook.status,
        createdAt: handbook.createdAt
      }
    };
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
    const { fileUrl, fileName, userId, version } = req.body;

    if (!fileUrl) {
      const response = { message: 'PDF file is required' };
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

    // Save new PDF to filesystem
    const { savePDFToFile, deletePDFFile } = await import('../utils/fileStorage.js');
    const newFilePath = savePDFToFile(fileUrl, fileName || handbook.fileName || 'handbook.pdf');
    
    // Delete old file if it exists and is different
    if (handbook.fileUrl && handbook.fileUrl !== newFilePath && !handbook.fileUrl.startsWith('data:')) {
      deletePDFFile(handbook.fileUrl);
    }

    // Extract text from PDF if a new file was uploaded
    if (newFilePath && newFilePath !== handbook.fileUrl) {
      try {
        handbook.pdfContent = await extractTextFromPDF(newFilePath);
      } catch (error) {
        console.error('Failed to extract PDF text:', error);
        // Keep existing content if extraction fails
      }
    }

    handbook.fileUrl = newFilePath; // Store file path instead of base64
    handbook.fileName = fileName || handbook.fileName || 'handbook.pdf';
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

// -------- Handbook Sidebar Sections --------

export const getHandbookSections = async (req, res, next) => {
  try {
    const sections = await HandbookSection.find()
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort({ order: 1, createdAt: 1 });
    const response = sections;
    logAndSetHeader(req, res, 'GET', '/api/president/handbook-sections', 200, { sections, count: sections.length });
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const createHandbookSection = async (req, res, next) => {
  try {
    const {
      userId,
      title,
      description,
      order,
      published = true,
      fileUrl,
      fileName,
    } = req.body;

    if (!userId) {
      const response = { message: 'User ID is required' };
      logAndSetHeader(req, res, 'POST', '/api/president/handbook-sections', 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      const response = { message: 'Only presidents can create sections' };
      logAndSetHeader(req, res, 'POST', '/api/president/handbook-sections', 403, response);
      return res.status(403).json(response);
    }

    if (!title || !fileUrl) {
      const response = { message: 'Title and PDF file are required' };
      logAndSetHeader(req, res, 'POST', '/api/president/handbook-sections', 400, response);
      return res.status(400).json(response);
    }

    const slug = await generateUniqueSectionSlug(title);

    let base64Content = fileUrl;
    if (fileUrl.includes(',')) {
      base64Content = fileUrl.split(',')[1];
    }
    const pdfBuffer = Buffer.from(base64Content, 'base64');

    const { uploadPDFToDrive, extractTextFromPDFBuffer } = await import('../utils/googleDrive.js');
    const driveFolderId = config.google.driveSectionsFolderId || config.google.driveFolderId || null;
    const sanitizedFileName = (fileName || `${slug}.pdf`).replace(/[^a-zA-Z0-9.-]/g, '_');
    const driveResult = await uploadPDFToDrive(pdfBuffer, sanitizedFileName, userId, driveFolderId);
    const pdfContent = await extractTextFromPDFBuffer(pdfBuffer);

    const section = new HandbookSection({
      title,
      description,
      order: parseOrderValue(order, 0),
      published: false,
      slug,
      fileUrl: driveResult.webContentLink || driveResult.previewUrl,
      googleDriveFileId: driveResult.fileId,
      googleDrivePreviewUrl: driveResult.previewUrl,
      pdfContent,
      createdBy: userId,
      status: 'pending'
    });

    await section.save();

    await logActivity(userId, 'handbook_section_create', `Created handbook sidebar section "${title}"`, {
      sectionId: section._id,
      title,
    }, req);

    const response = { message: 'Handbook sidebar section created', section };
    logAndSetHeader(req, res, 'POST', '/api/president/handbook-sections', 201, response);
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

export const updateHandbookSection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      userId,
      title,
      description,
      order,
      published,
      fileUrl,
      fileName,
    } = req.body;

    if (!userId) {
      const response = { message: 'User ID is required' };
      logAndSetHeader(req, res, 'PUT', `/api/president/handbook-sections/${id}`, 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      const response = { message: 'Only presidents can update sections' };
      logAndSetHeader(req, res, 'PUT', `/api/president/handbook-sections/${id}`, 403, response);
      return res.status(403).json(response);
    }

    const section = await HandbookSection.findById(id);
    if (!section) {
      const response = { message: 'Section not found' };
      logAndSetHeader(req, res, 'PUT', `/api/president/handbook-sections/${id}`, 404, response);
      return res.status(404).json(response);
    }

    if (title && title.trim() && title !== section.title) {
      section.title = title.trim();
      section.slug = await generateUniqueSectionSlug(section.title);
    }
    if (typeof description === 'string') {
      section.description = description;
    }
    if (typeof order !== 'undefined') {
      section.order = parseOrderValue(order, section.order);
    }
    if (fileUrl) {
      const { uploadPDFToDrive, deleteFileFromDrive, extractTextFromPDFBuffer } = await import('../utils/googleDrive.js');
      const { deletePDFFile } = await import('../utils/fileStorage.js');

      if (section.googleDriveFileId) {
        await deleteFileFromDrive(section.googleDriveFileId, userId);
      } else if (section.fileUrl && !section.fileUrl.startsWith('http')) {
        deletePDFFile(section.fileUrl);
      }

      let base64Data = fileUrl;
      if (fileUrl.includes(',')) {
        base64Data = fileUrl.split(',')[1];
      }
      const pdfBuffer = Buffer.from(base64Data, 'base64');
      const sanitizedFileName = (fileName || `${section.slug}.pdf`).replace(/[^a-zA-Z0-9.-]/g, '_');
      const driveFolderId = config.google.driveSectionsFolderId || config.google.driveFolderId || null;
      const driveResult = await uploadPDFToDrive(pdfBuffer, sanitizedFileName, userId, driveFolderId);

      section.fileUrl = driveResult.webContentLink || driveResult.previewUrl;
      section.googleDriveFileId = driveResult.fileId;
      section.googleDrivePreviewUrl = driveResult.previewUrl;
      section.pdfContent = await extractTextFromPDFBuffer(pdfBuffer);
    }

    section.status = 'pending';
    section.published = false;
    section.approvedBy = null;
    section.approvedAt = null;
    section.updatedBy = userId;
    await section.save();

    await logActivity(userId, 'handbook_section_update', `Updated handbook sidebar section "${section.title}"`, {
      sectionId: section._id,
      title: section.title,
    }, req);

    const response = { message: 'Section updated successfully', section };
    logAndSetHeader(req, res, 'PUT', `/api/president/handbook-sections/${id}`, 200, response);
    res.json(response);
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

const DEPARTMENT_LIST = getDepartments();

const slugify = (text = '') =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const generateUniqueSectionSlug = async (title) => {
  const baseSlug = slugify(title) || `section-${Date.now()}`;
  let slug = baseSlug;
  let counter = 1;
  // Loop until slug is unique
  // eslint-disable-next-line no-await-in-loop
  while (await HandbookSection.exists({ slug })) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
  return slug;
};

const parseOrderValue = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDepartmentTargets = ({ targetScope, departments = [], rangeStart, rangeEnd }) => {
  if (targetScope === 'departments') {
    const cleaned = departments
      .map((dept) => (typeof dept === 'string' ? dept.trim() : ''))
      .filter(Boolean)
      .filter((dept) => DEPARTMENT_LIST.includes(dept));
    return Array.from(new Set(cleaned));
  }
  if (targetScope === 'range') {
    if (!rangeStart || !rangeEnd) {
      return [];
    }
    const startIdx = DEPARTMENT_LIST.indexOf(rangeStart);
    const endIdx = DEPARTMENT_LIST.indexOf(rangeEnd);
    if (startIdx === -1 || endIdx === -1) {
      return [];
    }
    const [from, to] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    return DEPARTMENT_LIST.slice(from, to + 1);
  }
  return [];
};

// Create notification (only president)
export const createNotification = async (req, res, next) => {
  try {
    const {
      title,
      message,
      userId,
      targetScope = 'all',
      departments = [],
      rangeStart,
      rangeEnd
    } = req.body;

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

    if (!['all', 'departments', 'range'].includes(targetScope)) {
      const response = { message: 'Invalid target scope' };
      logAndSetHeader(req, res, 'POST', '/api/president/notifications', 400, response);
      return res.status(400).json(response);
    }

    const resolvedDepartments = normalizeDepartmentTargets({
      targetScope,
      departments,
      rangeStart,
      rangeEnd
    });

    if (targetScope !== 'all' && resolvedDepartments.length === 0) {
      const response = { message: 'Please select at least one valid department' };
      logAndSetHeader(req, res, 'POST', '/api/president/notifications', 400, response);
      return res.status(400).json(response);
    }

    const notification = new Notification({
      title,
      message,
      createdBy: userId,
      targetScope,
      targetDepartments: resolvedDepartments,
      rangeStart: targetScope === 'range' ? rangeStart : undefined,
      rangeEnd: targetScope === 'range' ? rangeEnd : undefined,
    });
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

    const departmentFilter = (notification.targetScope !== 'all' && notification.targetDepartments?.length)
      ? { department: { $in: notification.targetDepartments } }
      : {};

    // Send email to target users
    try {
      const allUsers = await User.find({
        email: { $exists: true, $ne: null },
        ...departmentFilter,
      });
      
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

    // Send push to target users 
    try {
      await sendPushToAllUsers(notification.title, notification.message, departmentFilter);
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

