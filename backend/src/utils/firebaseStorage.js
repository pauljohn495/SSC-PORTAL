import { getFirebaseAdmin } from '../config/firebaseAdmin.js';
import { Readable } from 'stream';

/**
 * Get Firebase Storage bucket
 * @returns {admin.storage.Bucket}
 */
const getStorageBucket = () => {
  const admin = getFirebaseAdmin();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
  
  // If bucket name is provided, use it (remove gs:// prefix if present)
  if (bucketName) {
    const cleanBucketName = bucketName.replace(/^gs:\/\//, '').trim();
    return admin.storage().bucket(cleanBucketName);
  }
  
  // Otherwise, use the default bucket from the Firebase project
  // This will use the bucket associated with the Firebase project
  const storage = admin.storage();
  return storage.bucket(); // Uses default bucket from project
};

/**
 * Upload a PDF file to Firebase Storage
 * @param {Buffer|string} fileData - PDF file buffer or base64 string
 * @param {string} fileName - Name of the file
 * @param {string} folder - Folder path in storage (e.g., 'handbooks', 'memorandums')
 * @returns {Promise<{downloadURL: string, filePath: string}>}
 */
export const uploadPDFToFirebase = async (fileData, fileName, folder = 'handbooks') => {
  try {
    const bucket = getStorageBucket();
    
    // Convert base64 to buffer if needed
    let buffer;
    if (typeof fileData === 'string') {
      // Handle base64 string (with or without data URL prefix)
      let base64Content = fileData;
      if (fileData.includes(',')) {
        base64Content = fileData.split(',')[1];
      }
      base64Content = base64Content.trim().replace(/\s/g, '');
      buffer = Buffer.from(base64Content, 'base64');
    } else {
      buffer = fileData;
    }
    
    if (!buffer || buffer.length === 0) {
      throw new Error('Invalid file data provided');
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = (fileName || 'document.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
    const filePath = `${folder}/${uniqueFileName}`;
    
    // Create file reference
    const file = bucket.file(filePath);
    
    // Create readable stream from buffer
    const stream = new Readable({
      read() {
        this.push(buffer);
        this.push(null); // End the stream
      }
    });
    
    // Upload file
    await new Promise((resolve, reject) => {
      const writeStream = file.createWriteStream({
        metadata: {
          contentType: 'application/pdf',
          cacheControl: 'public, max-age=31536000', // 1 year cache
        },
      });
      
      stream.pipe(writeStream);
      
      writeStream.on('error', (error) => {
        reject(new Error(`Failed to upload file to Firebase Storage: ${error.message}`));
      });
      
      writeStream.on('finish', () => {
        resolve();
      });
    });
    
    // Make file publicly accessible
    await file.makePublic();
    
    // Get public URL
    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    
    return {
      downloadURL,
      filePath,
      fileName: uniqueFileName,
    };
  } catch (error) {
    console.error('Error uploading PDF to Firebase Storage:', error);
    throw new Error(`Failed to upload PDF to Firebase Storage: ${error.message}`);
  }
};

/**
 * Delete a file from Firebase Storage
 * @param {string} filePath - File path in storage (e.g., 'handbooks/123456_file.pdf')
 * @returns {Promise<void>}
 */
export const deletePDFFromFirebase = async (filePath) => {
  try {
    if (!filePath) {
      return;
    }
    
    // Extract path if full URL is provided
    let storagePath = filePath;
    if (filePath.includes('storage.googleapis.com/')) {
      // URL format: https://storage.googleapis.com/BUCKET_NAME/path/to/file.pdf
      const urlParts = filePath.split('storage.googleapis.com/');
      if (urlParts.length > 1) {
        const afterDomain = urlParts[1];
        const parts = afterDomain.split('/');
        // Skip bucket name (first part) and join the rest
        storagePath = parts.slice(1).join('/');
      }
    }
    
    const bucket = getStorageBucket();
    const file = bucket.file(storagePath);
    
    // Check if file exists before deleting
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`Deleted file ${storagePath} from Firebase Storage`);
    } else {
      console.log(`File ${storagePath} not found in Firebase Storage (may have been already deleted)`);
    }
  } catch (error) {
    // Log error but don't throw - file deletion is not critical
    console.error(`Error deleting file ${filePath} from Firebase Storage:`, error.message || error);
  }
};

/**
 * Download a file from Firebase Storage
 * @param {string} filePath - File path in storage or full URL
 * @returns {Promise<Buffer>}
 */
export const downloadPDFFromFirebase = async (filePath) => {
  try {
    if (!filePath) {
      throw new Error('File path is required');
    }
    
    // Extract path if full URL is provided
    let storagePath = filePath;
    if (filePath.includes('storage.googleapis.com/')) {
      // URL format: https://storage.googleapis.com/BUCKET_NAME/path/to/file.pdf
      const urlParts = filePath.split('storage.googleapis.com/');
      if (urlParts.length > 1) {
        const afterDomain = urlParts[1];
        const parts = afterDomain.split('/');
        // Skip bucket name (first part) and join the rest
        storagePath = parts.slice(1).join('/');
      }
    }
    
    const bucket = getStorageBucket();
    const file = bucket.file(storagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File ${storagePath} not found in Firebase Storage`);
    }
    
    // Download file as buffer
    const [buffer] = await file.download();
    return buffer;
  } catch (error) {
    console.error('Error downloading PDF from Firebase Storage:', error);
    throw new Error(`Failed to download PDF from Firebase Storage: ${error.message}`);
  }
};

/**
 * Get a signed URL for temporary access (if needed for private files)
 * @param {string} filePath - File path in storage
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string>}
 */
export const getSignedURL = async (filePath, expiresIn = 3600) => {
  try {
    // Extract path if full URL is provided
    let storagePath = filePath;
    if (filePath.includes('storage.googleapis.com/')) {
      const urlParts = filePath.split('storage.googleapis.com/');
      if (urlParts.length > 1) {
        storagePath = urlParts[1].split('/').slice(1).join('/');
      }
    }
    
    const bucket = getStorageBucket();
    const file = bucket.file(storagePath);
    
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    });
    
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

