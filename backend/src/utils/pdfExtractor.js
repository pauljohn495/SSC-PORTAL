
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

      // Convert base64 to buffer
      buffer = Buffer.from(base64Data, 'base64');
    }

    // Extract text from PDF using PDFParse class
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    
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

