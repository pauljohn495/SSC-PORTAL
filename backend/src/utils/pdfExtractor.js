
import { PDFParse } from 'pdf-parse';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Extract text content from a PDF (base64-encoded or file path)
 * @param {string} pdfSource - Base64 encoded PDF or file path
 * @returns {Promise<string>} 
 */
export const extractTextFromPDF = async (pdfSource) => {
  try {
    let buffer;

    // Check if it's a file path (starts with 'uploads/')
    if (pdfSource && !pdfSource.startsWith('data:') && pdfSource.startsWith('uploads/')) {
      // Read from file system
      const fullPath = path.join(__dirname, '../../', pdfSource);
      if (!fs.existsSync(fullPath)) {
        console.error('PDF file not found:', fullPath);
        return '';
      }
      buffer = fs.readFileSync(fullPath);
    } else {
      // Handle base64 encoded PDF
      let base64Data = pdfSource;
      if (pdfSource && pdfSource.includes('base64,')) {
        base64Data = pdfSource.split('base64,')[1];
      }

      if (!base64Data) {
        return '';
      }

      // Convert base64 to buffer with proper validation
      // Remove any whitespace that might cause issues
      base64Data = base64Data.trim().replace(/\s/g, '');
      
      try {
        buffer = Buffer.from(base64Data, 'base64');
        
        // Validate buffer was created correctly
        if (!buffer || buffer.length === 0) {
          console.error('Failed to create buffer from base64 data');
          return '';
        }
      } catch (bufferError) {
        console.error('Error converting base64 to buffer:', bufferError);
        return '';
      }
    }

    // Extract text from PDF using PDFParse class
    // PDFParse has known issues with large files and can throw offset errors
    // For safety, skip extraction for files larger than 80MB
    const bufferSizeMB = buffer.length / (1024 * 1024);
    if (bufferSizeMB > 80) {
      console.warn(`PDF file is ${bufferSizeMB.toFixed(2)}MB. Skipping text extraction to avoid offset errors.`);
      return '';
    }
    
    // Validate buffer integrity before parsing
    if (!buffer || buffer.length === 0) {
      console.error('Invalid buffer provided for PDF extraction');
      return '';
    }
    
    let textResult;
    try {
      // Wrap both instantiation and method call in try-catch
      // PDFParse constructor can throw synchronously for corrupted/large files
      let parser;
      try {
        parser = new PDFParse({ data: buffer });
      } catch (constructorError) {
        const errorMsg = constructorError?.message || String(constructorError);
        console.error('Error creating PDFParse instance:', errorMsg);
        return '';
      }
      
      // Add timeout for getText() in case it hangs on large files
      const extractionPromise = parser.getText();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('PDF text extraction timeout')), 30000)
      );
      
      textResult = await Promise.race([extractionPromise, timeoutPromise]);
    } catch (parseError) {
      // Handle all parsing errors gracefully - return empty string instead of failing
      const errorMsg = parseError?.message || String(parseError);
      if (errorMsg.includes('offset') || 
          errorMsg.includes('out of range') ||
          errorMsg.includes('RangeError') ||
          errorMsg.includes('must be >=') ||
          errorMsg.includes('timeout')) {
        console.error('PDF parsing error (likely due to file size):', errorMsg);
      } else {
        console.error('Error parsing PDF:', errorMsg);
      }
      // Always return empty string to prevent upload failure
      return '';
    }
    
    // Return extracted text, limiting to reasonable size 
    // getText() returns a TextResult object with a 'text' property
    const text = textResult?.text || textResult || '';
    
    // Limit text size to prevent database issues
    const maxLength = 1000000; // ~1MB
    if (text.length > maxLength) {
      return text.substring(0, maxLength) + '... [Content truncated]';
    }
    
    return text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    // Return empty string if extraction fails 
    return '';
  }
};

