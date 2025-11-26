import { google } from 'googleapis';
import { Readable } from 'stream';
import { config } from '../config/index.js';
import User from '../models/User.js';

/**
 * Get OAuth2 client for Google Drive
 * @param {Object} tokens - OAuth tokens (optional)
 * @returns {google.auth.OAuth2Client}
 */
const getOAuth2Client = (tokens) => {
  const oAuth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
  if (tokens) {
    oAuth2Client.setCredentials(tokens);
  }
  return oAuth2Client;
};

/**
 * Get authenticated Google Drive client using OAuth2
 * @param {string} userId - User ID to get OAuth tokens from
 * @returns {Promise<google.drive_v3.Drive>}
 */
const getDriveClient = async (userId) => {
  try {
    if (!userId) {
      throw new Error('User ID is required for Google Drive access');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (!user.googleDrive?.refreshToken && !user.googleDrive?.accessToken) {
      throw new Error('Google Drive not connected. Please connect your Google Drive account first.');
    }

    const tokens = {
      access_token: user.googleDrive?.accessToken,
      refresh_token: user.googleDrive?.refreshToken,
      scope: user.googleDrive?.scope,
      token_type: user.googleDrive?.tokenType,
      expiry_date: user.googleDrive?.expiryDate
    };

    const auth = getOAuth2Client(tokens);
    
    // Refresh token if needed
    if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
      const { credentials } = await auth.refreshAccessToken();
      // Update user's tokens
      user.googleDrive = {
        accessToken: credentials.access_token,
        refreshToken: credentials.refresh_token || user.googleDrive?.refreshToken,
        scope: credentials.scope || user.googleDrive?.scope,
        tokenType: credentials.token_type || user.googleDrive?.tokenType,
        expiryDate: credentials.expiry_date || user.googleDrive?.expiryDate
      };
      await user.save();
      auth.setCredentials(credentials);
    }

    // Create and return Drive client
    const drive = google.drive({ version: 'v3', auth });
    return drive;
  } catch (error) {
    console.error('Error initializing Google Drive client:', error);
    throw error;
  }
};

/**
 * Upload a PDF file to Google Drive
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} fileName - Name of the file
 * @param {string} userId - User ID for OAuth authentication
 * @param {string} folderId - Optional Google Drive folder ID to upload to
 * @returns {Promise<{fileId: string, webViewLink: string, webContentLink: string}>}
 */
export const uploadPDFToDrive = async (pdfBuffer, fileName, userId, folderId = null) => {
  try {
    const drive = await getDriveClient(userId);
    
    // Convert Buffer to Stream (Google Drive API requires a stream)
    // Create a readable stream from the buffer
    const bufferStream = new Readable({
      read() {
        this.push(pdfBuffer);
        this.push(null); // End the stream
      }
    });

    // Prepare media for upload
    const media = {
      mimeType: 'application/pdf',
      body: bufferStream,
    };

    // Prepare file metadata
    const fileMetadata = {
      name: fileName,
      mimeType: 'application/pdf',
    };

    // Validate folder exists if provided, otherwise upload to root
    if (folderId) {
      try {
        // Check if folder exists and is accessible
        await drive.files.get({
          fileId: folderId,
          fields: 'id, name, mimeType',
        });
        fileMetadata.parents = [folderId];
      } catch (folderError) {
        // If folder doesn't exist or is inaccessible, log warning and upload to root
        console.warn(`Folder ${folderId} not found or inaccessible. Uploading to root instead.`);
        // Continue without folder - file will be uploaded to root
      }
    }

    // Upload file
    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, webViewLink, webContentLink',
    });

    const fileId = response.data.id;
    
    // Make the file publicly viewable (required for Google Drive viewer)
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    });

    // Get the preview URL (Google Drive PDF viewer)
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;

    return {
      fileId: fileId,
      webViewLink: response.data.webViewLink || previewUrl,
      webContentLink: response.data.webContentLink,
      previewUrl: previewUrl,
    };
  } catch (error) {
    console.error('Error uploading PDF to Google Drive:', error);
    throw new Error(`Failed to upload PDF to Google Drive: ${error.message}`);
  }
};

/**
 * Delete a file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @param {string} userId - User ID for OAuth authentication
 * @returns {Promise<void>}
 */
export const deleteFileFromDrive = async (fileId, userId) => {
  try {
    if (!fileId) {
      return;
    }

    if (!userId) {
      console.warn('User ID not provided for deleteFileFromDrive. Skipping deletion.');
      return;
    }

    const drive = await getDriveClient(userId);
    await drive.files.delete({
      fileId: fileId,
    });
    console.log(`Deleted file ${fileId} from Google Drive`);
  } catch (error) {
    // Handle "file not found" errors gracefully - file might already be deleted
    if (error.message && (error.message.includes('File not found') || error.message.includes('not found'))) {
      console.log(`File ${fileId} not found in Google Drive (may have been already deleted)`);
      return; // Silently ignore - file doesn't exist, which is what we want
    }
    // Log other errors but don't throw - we don't want to break the upload process
    console.error(`Error deleting file ${fileId} from Google Drive:`, error.message || error);
  }
};

export const downloadFileFromDrive = async (fileId, userId) => {
  if (!fileId) {
    throw new Error('File ID is required to download from Google Drive');
  }
  if (!userId) {
    throw new Error('User ID is required to download from Google Drive');
  }
  const drive = await getDriveClient(userId);
  const response = await drive.files.get(
    { fileId, alt: 'media' },
    { responseType: 'stream' }
  );
  const chunks = [];
  return await new Promise((resolve, reject) => {
    response.data.on('data', (chunk) => chunks.push(chunk));
    response.data.on('end', () => resolve(Buffer.concat(chunks)));
    response.data.on('error', (error) => reject(error));
  });
};

/**
 * Extract text from PDF buffer (for search indexing)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<string>}
 */
export const extractTextFromPDFBuffer = async (pdfBuffer) => {
  try {
    const { extractTextFromPDF } = await import('./pdfExtractor.js');
    // Convert buffer to base64 for the extractor
    const base64Data = pdfBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Data}`;
    return await extractTextFromPDF(dataUrl);
  } catch (error) {
    console.error('Error extracting text from PDF buffer:', error);
    return '';
  }
};

