
import { PDFParse } from 'pdf-parse';

/**
 * Extract text content from a base64-encoded PDF
 * @param {string} base64File 
 * @returns {Promise<string>} 
 */
export const extractTextFromPDF = async (base64File) => {
  try {
    // Remove data URI prefix if present
    let base64Data = base64File;
    if (base64File.includes('base64,')) {
      base64Data = base64File.split('base64,')[1];
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

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

