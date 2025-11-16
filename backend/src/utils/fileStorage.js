import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/handbooks');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Save base64 PDF to filesystem
 * @param {string} base64Data - Base64 encoded PDF data (with or without data URL prefix)
 * @param {string} fileName - Original filename
 * @returns {string} - File path relative to uploads directory
 */
export const savePDFToFile = (base64Data, fileName) => {
  try {
    // Remove data URL prefix if present (data:application/pdf;base64,...)
    let base64Content = base64Data;
    if (base64Data.includes(',')) {
      base64Content = base64Data.split(',')[1];
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${timestamp}_${sanitizedFileName}`;
    const filePath = path.join(uploadsDir, uniqueFileName);

    // Convert base64 to buffer and write to file
    const buffer = Buffer.from(base64Content, 'base64');
    fs.writeFileSync(filePath, buffer);

    // Return relative path for storage in database
    return `uploads/handbooks/${uniqueFileName}`;
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
export const getUploadsDir = () => uploadsDir;

