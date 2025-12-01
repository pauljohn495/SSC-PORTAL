import User from '../models/User.js';
import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import ActivityLog from '../models/ActivityLog.js';
import Notification from '../models/Notification.js';
import HandbookSection from '../models/HandbookSection.js';
import { logActivity } from '../utils/activityLogger.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { emitGlobal } from '../realtime/socket.js';
import { extractTextFromPDF } from '../utils/pdfExtractor.js';
import { google } from 'googleapis';
import { getDepartments } from '../data/departments.js';

// Helper function to create simplified log and set response header
const logAndSetHeader = (req, res, method, endpoint, status, responseData) => {
  // Skip logging for president handbook endpoints and drive status
  if (endpoint && (
    endpoint.includes('/president/handbook') || 
    endpoint.includes('/president/handbook-sections') ||
    endpoint.includes('/president/drive/status')
  )) {
    return null;
  }
  
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

// Google Drive OAuth endpoints removed - using Cloudinary instead (no OAuth needed)

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

    // Upload PDF to Cloudinary
    const { uploadPDFToCloudinary, extractTextFromPDFBuffer } = await import('../utils/cloudinary.js');
    
    let base64Content = fileUrl;
    if (fileUrl.includes(',')) {
      base64Content = fileUrl.split(',')[1];
    }
    base64Content = base64Content.trim().replace(/\s/g, '');
    
    let pdfBuffer;
    try {
      pdfBuffer = Buffer.from(base64Content, 'base64');
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Failed to create buffer from base64 data');
      }
    } catch (bufferError) {
      console.error('Error converting base64 to buffer:', bufferError);
      const response = { message: 'Failed to process PDF file. Invalid file format.' };
      return res.status(400).json(response);
    }
    
    // Check file size before uploading (limit to 80MB)
    const bufferSizeMB = pdfBuffer.length / (1024 * 1024);
    if (bufferSizeMB > 80) {
      const response = { message: `PDF file is ${bufferSizeMB.toFixed(2)}MB. File size exceeds 80MB limit.` };
      return res.status(400).json(response);
    }
    
    // Upload to Cloudinary
    const sanitizedFileName = (fileName || `${title}_${year}.pdf`).replace(/[^a-zA-Z0-9.-]/g, '_');
    const cloudinaryResult = await uploadPDFToCloudinary(pdfBuffer, sanitizedFileName, 'memorandums');
    
    // Extract text content for search indexing
    let pdfContent = '';
    try {
      if (bufferSizeMB <= 80) {
        pdfContent = await extractTextFromPDFBuffer(pdfBuffer);
      }
    } catch (error) {
      console.error('Failed to extract PDF text:', error);
      // Continue even if extraction fails
    }

    const memorandum = new Memorandum({ 
      title, 
      year, 
      fileUrl: cloudinaryResult.previewUrl, // Store Cloudinary preview URL
      fileName: sanitizedFileName, 
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

    if (!memorandum.priorityEditor || memorandum.priorityEditor.toString() === userId) {
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

    // If another user currently holds edit priority, block this save.
    // If priority is not set at all (e.g., legacy data or a failed priority call),
    // allow the update so a single user is never locked out.
    if (memorandum.priorityEditor && memorandum.priorityEditor.toString() !== userId) {
      const response = { 
        message: 'You do not have edit priority. Only the first user to click edit can save changes.',
        hasPriority: false
      };
      logAndSetHeader(req, res, 'PUT', `/api/president/memorandums/${id}`, 409, response);
      return res.status(409).json(response);
    }

    // Optimistic concurrency check:
    // - If the client sends a numeric version that does NOT match the current
    //   version in the database, we block the update.
    // - If the client omits the version or sends an invalid value, we skip
    //   this check so users are not permanently locked out by bad local state.
    if (Number.isFinite(Number(version))) {
      const numericVersion = Number(version);
      if (memorandum.version !== numericVersion) {
        const response = { message: 'Document has been modified. Please refresh and try again.' };
        logAndSetHeader(req, res, 'PUT', `/api/president/memorandums/${id}`, 409, response);
        return res.status(409).json(response);
      }
    }

    const oldFileUrl = memorandum.fileUrl;
    memorandum.title = title;
    memorandum.year = year;
    
    // Check if it's a new file (base64) or existing Cloudinary URL
    const isBase64 = fileUrl && (fileUrl.startsWith('data:') || (!fileUrl.startsWith('http') && !fileUrl.startsWith('uploads/')));
    
    if (isBase64 && fileUrl !== oldFileUrl) {
      // New file upload - upload to Cloudinary
      const { uploadPDFToCloudinary, deleteFileFromCloudinary, extractTextFromPDFBuffer } = await import('../utils/cloudinary.js');
      
      let base64Data = fileUrl;
      if (fileUrl.includes(',')) {
        base64Data = fileUrl.split(',')[1];
      }
      base64Data = base64Data.trim().replace(/\s/g, '');
      
      let pdfBuffer;
      try {
        pdfBuffer = Buffer.from(base64Data, 'base64');
        if (!pdfBuffer || pdfBuffer.length === 0) {
          throw new Error('Failed to create buffer from base64 data');
        }
      } catch (bufferError) {
        console.error('Error converting base64 to buffer:', bufferError);
        const response = { message: 'Failed to process PDF file. Invalid file format.' };
        return res.status(400).json(response);
      }
      
      // Check file size before uploading (limit to 80MB)
      const bufferSizeMB = pdfBuffer.length / (1024 * 1024);
      if (bufferSizeMB > 80) {
        const response = { message: `PDF file is ${bufferSizeMB.toFixed(2)}MB. File size exceeds 80MB limit.` };
        return res.status(400).json(response);
      }
      
      // Delete old file from Cloudinary if it exists (extract publicId from old URL)
      // Old URL format: https://res.cloudinary.com/.../publicId.pdf
      if (oldFileUrl && oldFileUrl.includes('cloudinary.com')) {
        try {
          // Extract public ID from Cloudinary URL
          const urlParts = oldFileUrl.split('/');
          const fileNamePart = urlParts[urlParts.length - 1];
          const publicId = fileNamePart.replace(/\.pdf$/i, '');
          if (publicId) {
            await deleteFileFromCloudinary(publicId);
          }
        } catch (error) {
          console.warn('Failed to delete old Cloudinary file:', error.message);
        }
      }
      
      // Upload new file to Cloudinary
      const sanitizedFileName = (fileName || `${title}_${year}.pdf`).replace(/[^a-zA-Z0-9.-]/g, '_');
      const cloudinaryResult = await uploadPDFToCloudinary(pdfBuffer, sanitizedFileName, 'memorandums');
      
      memorandum.fileUrl = cloudinaryResult.previewUrl;
      memorandum.fileName = sanitizedFileName;
      
      // Extract text from PDF
      try {
        if (bufferSizeMB <= 80) {
          memorandum.pdfContent = await extractTextFromPDFBuffer(pdfBuffer);
        }
      } catch (error) {
        console.error('Failed to extract PDF text:', error);
        // Keep existing content if extraction fails
      }
    } else if (fileUrl) {
      // Existing Cloudinary URL - just update if different
      memorandum.fileUrl = fileUrl;
      if (fileName !== undefined) {
        memorandum.fileName = fileName || '';
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
      // Delete old Cloudinary files (handle errors gracefully)
      const { deleteFileFromCloudinary } = await import('../utils/cloudinary.js');
      for (const oldHandbook of existingApproved) {
        if (oldHandbook.cloudinaryPublicId) {
          try {
            await deleteFileFromCloudinary(oldHandbook.cloudinaryPublicId);
          } catch (error) {
            // Log but continue - file might not exist or deletion might fail
            console.warn(`Could not delete Cloudinary file ${oldHandbook.cloudinaryPublicId}:`, error.message);
          }
        }
        // Also handle old file system files for backward compatibility
        if (oldHandbook.fileUrl && !oldHandbook.fileUrl.startsWith('data:') && !oldHandbook.fileUrl.startsWith('http')) {
          try {
            const { deletePDFFile } = await import('../utils/fileStorage.js');
            deletePDFFile(oldHandbook.fileUrl);
          } catch (error) {
            console.warn(`Could not delete file system file ${oldHandbook.fileUrl}:`, error.message);
          }
        }
      }
      // Delete old handbook entries
      await Handbook.deleteMany({ status: 'approved' });
    }

    // Convert base64 to buffer with proper validation
    let base64Content = fileUrl;
    if (fileUrl.includes(',')) {
      base64Content = fileUrl.split(',')[1];
    }
    
    // Remove any whitespace that might cause issues
    base64Content = base64Content.trim().replace(/\s/g, '');
    
    let pdfBuffer;
    try {
      pdfBuffer = Buffer.from(base64Content, 'base64');
      
      // Validate buffer was created correctly
      if (!pdfBuffer || pdfBuffer.length === 0) {
        const response = { message: 'Failed to process PDF file. The file may be corrupted.' };
        return res.status(400).json(response);
      }
    } catch (bufferError) {
      console.error('Error converting base64 to buffer:', bufferError);
      const response = { message: 'Failed to process PDF file. Invalid file format.' };
      return res.status(400).json(response);
    }

    // Check file size before uploading (limit to 80MB)
    const bufferSizeMB = pdfBuffer.length / (1024 * 1024);
    if (bufferSizeMB > 80) {
      const response = { message: `PDF file is ${bufferSizeMB.toFixed(2)}MB. File size exceeds 80MB limit.` };
      return res.status(400).json(response);
    }

    // Upload whole PDF to Cloudinary
    const { uploadPDFToCloudinary, extractTextFromPDFBuffer } = await import('../utils/cloudinary.js');
    
    const sanitizedFileName = (fileName || 'handbook.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');
    
    console.log('Uploading PDF to Cloudinary...');
    const cloudinaryResult = await uploadPDFToCloudinary(pdfBuffer, sanitizedFileName, 'handbooks');
    
    // Extract text content from PDF for search indexing
    // For large files, this may fail, so we make it optional
    console.log('Extracting text from PDF for search...');
    let pdfContent = '';
    try {
      if (bufferSizeMB <= 80) {
        pdfContent = await extractTextFromPDFBuffer(pdfBuffer);
        if (pdfContent) {
          console.log(`Extracted ${pdfContent.length} characters from PDF`);
        }
      }
    } catch (extractError) {
      console.warn('Failed to extract text from PDF (file may be too large). Continuing without text extraction:', extractError.message);
      // Continue without text extraction - the file will still be uploaded
      pdfContent = '';
    }
    
    // Create single Handbook entry for the whole PDF
    const handbook = new Handbook({
      fileName: sanitizedFileName,
      cloudinaryPublicId: cloudinaryResult.publicId,
      cloudinaryUrl: cloudinaryResult.previewUrl,
      pdfContent: pdfContent,
      createdBy: userId
    });
    await handbook.save();

    await logActivity(userId, 'handbook_create', `Handbook created and uploaded to Cloudinary: ${sanitizedFileName}`, { 
      fileName: sanitizedFileName,
      cloudinaryPublicId: cloudinaryResult.publicId
    }, req);

    // Return summary
    const response = { 
      message: 'Handbook draft created and uploaded to Cloudinary', 
      handbook: {
        _id: handbook._id,
        fileName: handbook.fileName,
        cloudinaryPublicId: handbook.cloudinaryPublicId,
        cloudinaryUrl: handbook.cloudinaryUrl,
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

    // If another user currently holds edit priority, block this save.
    // If priority is not set at all, allow the update so a single user
    // is not blocked by missing priority state.
    if (handbook.priorityEditor && handbook.priorityEditor.toString() !== userId) {
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
    // Exclude large fields and use lean() for faster queries
    const sections = await HandbookSection.find(
      { archived: { $ne: true } },
      { fileUrl: 0, pdfContent: 0 } // Exclude large fields
    )
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('editedBy', 'name email')
      .sort({ order: 1, createdAt: 1 })
      .lean();
    
    res.json(sections);
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
    
    // Remove any whitespace that might cause issues
    base64Content = base64Content.trim().replace(/\s/g, '');
    
    let pdfBuffer;
    try {
      pdfBuffer = Buffer.from(base64Content, 'base64');
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Failed to create buffer from base64 data');
      }
    } catch (bufferError) {
      console.error('Error converting base64 to buffer:', bufferError);
      const response = { message: 'Failed to process PDF file. Invalid file format.' };
      return res.status(400).json(response);
    }

    // Check file size before uploading (limit to 80MB)
    const bufferSizeMB = pdfBuffer.length / (1024 * 1024);
    if (bufferSizeMB > 80) {
      const response = { message: `PDF file is ${bufferSizeMB.toFixed(2)}MB. File size exceeds 80MB limit.` };
      return res.status(400).json(response);
    }
    
    // Upload to Cloudinary
    const { uploadPDFToCloudinary, extractTextFromPDFBuffer } = await import('../utils/cloudinary.js');
    const sanitizedFileName = (fileName || `${slug}.pdf`).replace(/[^a-zA-Z0-9.-]/g, '_');
    
    const cloudinaryResult = await uploadPDFToCloudinary(pdfBuffer, sanitizedFileName, 'handbook-sections');
    
    // Extract text content - make it optional for large files
    let pdfContent = '';
    try {
      if (bufferSizeMB <= 80) {
        pdfContent = await extractTextFromPDFBuffer(pdfBuffer);
      }
    } catch (extractError) {
      const errorMsg = extractError?.message || String(extractError);
      console.warn('Failed to extract text from PDF (file may be too large). Continuing without text extraction:', errorMsg);
      // Continue without text extraction
      pdfContent = '';
    }

    const section = new HandbookSection({
      title,
      description,
      order: parseOrderValue(order, 0),
      published: false,
      slug,
      fileUrl: cloudinaryResult.previewUrl, // Store Cloudinary preview URL
      fileName: sanitizedFileName,
      cloudinaryPublicId: cloudinaryResult.publicId,
      cloudinaryUrl: cloudinaryResult.previewUrl,
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
      version,
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

    // If another user currently holds edit priority, block this save.
    // If priority is not set at all (e.g., legacy data or a failed priority call),
    // allow the update so a single user is never locked out.
    if (section.priorityEditor && section.priorityEditor.toString() !== userId) {
      const response = { 
        message: 'You do not have edit priority. Only the first user to click edit can save changes.',
        hasPriority: false
      };
      logAndSetHeader(req, res, 'PUT', `/api/president/handbook-sections/${id}`, 409, response);
      return res.status(409).json(response);
    }

    // Optimistic concurrency: if client sends a numeric version and it
    // does not match the current one, reject with a conflict.
    if (Number.isFinite(Number(version))) {
      const numericVersion = Number(version);
      if ((section.version || 1) !== numericVersion) {
        const response = { message: 'Section has been modified. Please refresh and try again.' };
        logAndSetHeader(req, res, 'PUT', `/api/president/handbook-sections/${id}`, 409, response);
        return res.status(409).json(response);
      }
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
      // Check if it's a new file (base64) or existing Google Drive URL
      const isBase64 = fileUrl.startsWith('data:') || (!fileUrl.startsWith('http') && !fileUrl.startsWith('uploads/'));
      
      if (isBase64) {
        // New file upload - upload to Cloudinary
        const { uploadPDFToCloudinary, deleteFileFromCloudinary, extractTextFromPDFBuffer } = await import('../utils/cloudinary.js');
        
        let base64Data = fileUrl;
        if (fileUrl.includes(',')) {
          base64Data = fileUrl.split(',')[1];
        }
        
        base64Data = base64Data.trim().replace(/\s/g, '');
        
        let pdfBuffer;
        try {
          pdfBuffer = Buffer.from(base64Data, 'base64');
          if (!pdfBuffer || pdfBuffer.length === 0) {
            throw new Error('Failed to create buffer from base64 data');
          }
        } catch (bufferError) {
          console.error('Error converting base64 to buffer:', bufferError);
          const response = { message: 'Failed to process PDF file. Invalid file format.' };
          return res.status(400).json(response);
        }
        
        // Check file size before uploading (limit to 80MB)
        const bufferSizeMB = pdfBuffer.length / (1024 * 1024);
        if (bufferSizeMB > 80) {
          const response = { message: `PDF file is ${bufferSizeMB.toFixed(2)}MB. File size exceeds 80MB limit.` };
          return res.status(400).json(response);
        }
        
        // Delete old file from Cloudinary if it exists
        if (section.cloudinaryPublicId) {
          try {
            await deleteFileFromCloudinary(section.cloudinaryPublicId);
          } catch (error) {
            console.warn('Failed to delete old Cloudinary file:', error.message);
          }
        }
        
        // Upload new file to Cloudinary
        const sanitizedFileName = (fileName || `${section.slug}.pdf`).replace(/[^a-zA-Z0-9.-]/g, '_');
        const cloudinaryResult = await uploadPDFToCloudinary(pdfBuffer, sanitizedFileName, 'handbook-sections');
        
        section.fileUrl = cloudinaryResult.previewUrl;
        section.fileName = sanitizedFileName;
        section.cloudinaryPublicId = cloudinaryResult.publicId;
        section.cloudinaryUrl = cloudinaryResult.previewUrl;
        
        // Extract text content - make it optional for large files
        try {
          if (bufferSizeMB <= 80) {
            section.pdfContent = await extractTextFromPDFBuffer(pdfBuffer);
          } else {
            section.pdfContent = section.pdfContent || '';
          }
        } catch (extractError) {
          const errorMsg = extractError?.message || String(extractError);
          console.warn('Failed to extract text from PDF (file may be too large). Continuing without text extraction:', errorMsg);
          section.pdfContent = section.pdfContent || '';
        }
      } else {
        // Existing Cloudinary URL or file path - just update fileName if provided
        if (fileName) {
          section.fileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        }
      }
    }

    section.status = 'pending';
    section.published = false;
    section.approvedBy = null;
    section.approvedAt = null;
    section.updatedBy = userId;
    section.editedBy = userId;
    section.editedAt = new Date();
    section.version = (section.version || 1) + 1;
    section.priorityEditor = null;
    section.priorityEditStartedAt = null;
    await section.save();

    await logActivity(userId, 'handbook_section_update', `Updated handbook sidebar section "${section.title}"`, {
      sectionId: section._id,
      title: section.title,
    }, req);

    // Populate user fields before sending response
    await section.populate('createdBy', 'name email');
    await section.populate('updatedBy', 'name email');
    await section.populate('editedBy', 'name email');

    const response = { message: 'Section updated successfully', section };
    logAndSetHeader(req, res, 'PUT', `/api/president/handbook-sections/${id}`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const setHandbookSectionPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      const response = { message: 'Only presidents can set edit priority', hasPriority: false };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook-sections/${id}/priority`, 403, response);
      return res.status(403).json(response);
    }

    const section = await HandbookSection.findById(id);
    if (!section) {
      const response = { message: 'Section not found', hasPriority: false };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook-sections/${id}/priority`, 404, response);
      return res.status(404).json(response);
    }

    if (!section.priorityEditor) {
      section.priorityEditor = userId;
      section.priorityEditStartedAt = new Date();
      await section.save();
      
      const response = { 
        message: 'You have edit priority', 
        section,
        hasPriority: true
      };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook-sections/${id}/priority`, 200, response);
      return res.status(200).json(response);
    }

    if (section.priorityEditor.toString() === userId) {
      const response = { 
        message: 'You already have edit priority', 
        section,
        hasPriority: true
      };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook-sections/${id}/priority`, 200, response);
      return res.status(200).json(response);
    }

    // Check if priority has expired (30 minutes)
    const priorityAge = Date.now() - new Date(section.priorityEditStartedAt).getTime();
    const PRIORITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    if (priorityAge > PRIORITY_TIMEOUT) {
      section.priorityEditor = userId;
      section.priorityEditStartedAt = new Date();
      await section.save();
      
      const response = { 
        message: 'Previous edit priority expired. You now have edit priority.', 
        section,
        hasPriority: true
      };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook-sections/${id}/priority`, 200, response);
      return res.status(200).json(response);
    }

    const response = { 
      message: 'Someone else is currently editing this section', 
      hasPriority: false
    };
    logAndSetHeader(req, res, 'POST', `/api/president/handbook-sections/${id}/priority`, 200, response);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const clearHandbookSectionPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      const response = { message: 'Only presidents can clear edit priority' };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook-sections/${id}/clear-priority`, 403, response);
      return res.status(403).json(response);
    }

    const section = await HandbookSection.findById(id);
    if (!section) {
      const response = { message: 'Section not found' };
      logAndSetHeader(req, res, 'POST', `/api/president/handbook-sections/${id}/clear-priority`, 404, response);
      return res.status(404).json(response);
    }

    if (section.priorityEditor && section.priorityEditor.toString() === userId) {
      section.priorityEditor = null;
      section.priorityEditStartedAt = null;
      await section.save();
    }

    const response = { message: 'Priority cleared' };
    logAndSetHeader(req, res, 'POST', `/api/president/handbook-sections/${id}/clear-priority`, 200, response);
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

const normalizeDepartmentTargets = ({ targetScope, departments = [] }) => {
  if (targetScope === 'departments') {
    const cleaned = departments
      .map((dept) => (typeof dept === 'string' ? dept.trim() : ''))
      .filter(Boolean)
      .filter((dept) => DEPARTMENT_LIST.includes(dept));
    return Array.from(new Set(cleaned));
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
      departments = []
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

    if (!['all', 'departments'].includes(targetScope)) {
      const response = { message: 'Invalid target scope' };
      logAndSetHeader(req, res, 'POST', '/api/president/notifications', 400, response);
      return res.status(400).json(response);
    }

    const resolvedDepartments = normalizeDepartmentTargets({
      targetScope,
      departments
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
      targetDepartments: resolvedDepartments
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

