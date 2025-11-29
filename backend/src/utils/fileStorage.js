import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootUploadsDir = path.join(__dirname, '../../uploads');

const ensureDirectory = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
};

ensureDirectory(rootUploadsDir);

const resolveSubdirectory = (subdirectory = 'handbooks') => {
  const safeSubdir = subdirectory.replace(/[^a-z0-9/_-]/gi, '');
  const targetDir = path.join(rootUploadsDir, safeSubdir);
  return ensureDirectory(targetDir);
};

/**
 * Save base64 PDF to filesystem
 * @param {string} base64Data - Base64 encoded PDF data (with or without data URL prefix)
 * @param {string} fileName - Original filename
 * @param {string} subdirectory - Subfolder inside /uploads (default handbooks)
 * @returns {string} - File path relative to project root (e.g., uploads/handbooks/file.pdf)
 */
export const savePDFToFile = (base64Data, fileName, subdirectory = 'handbooks') => {
  try {
    // Remove data URL prefix if present (data:application/pdf;base64,...)
    let base64Content = base64Data;
    if (base64Data.includes(',')) {
      base64Content = base64Data.split(',')[1];
    }

    // Remove any whitespace that might cause issues
    base64Content = base64Content.trim().replace(/\s/g, '');

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = (fileName || 'document.pdf').replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
    const targetDir = resolveSubdirectory(subdirectory);
    const filePath = path.join(targetDir, uniqueFileName);

    // Convert base64 to buffer and write to file with validation
    let buffer;
    try {
      buffer = Buffer.from(base64Content, 'base64');
      if (!buffer || buffer.length === 0) {
        throw new Error('Failed to create buffer from base64 data');
      }
    } catch (bufferError) {
      console.error('Error converting base64 to buffer:', bufferError);
      throw new Error('Failed to process PDF file. Invalid file format.');
    }
    
    fs.writeFileSync(filePath, buffer);

    // Return relative path for storage in database
    return `uploads/${subdirectory}/${uniqueFileName}`;
  } catch (error) {
    console.error('Error saving PDF to file:', error);
    throw new Error('Failed to save PDF file');
  }
};

/**
 * Read PDF file from filesystem
 * @param {string} filePath - Relative file path from uploads directory
 * @returns {Buffer} - File buffer
 */
export const readPDFFromFile = (filePath) => {
  try {
    const fullPath = path.join(__dirname, '../../', filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }
    return fs.readFileSync(fullPath);
  } catch (error) {
    console.error('Error reading PDF from file:', error);
    throw new Error('Failed to read PDF file');
  }
};

/**
 * Delete PDF file from filesystem
 * @param {string} filePath - Relative file path from uploads directory
 */
export const deletePDFFile = (filePath) => {
  try {
    const fullPath = path.join(__dirname, '../../', filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  } catch (error) {
    console.error('Error deleting PDF file:', error);
    // Don't throw - file deletion is not critical
  }
};

/**
 * Get the absolute path to uploads directory
 */
export const getUploadsDir = (subdirectory = 'handbooks') => resolveSubdirectory(subdirectory);

