import { PDFDocument } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromPDF } from './pdfExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '../../uploads/handbooks');

/**
 * Split a PDF into individual pages and save each as a separate file
 * @param {string} base64Data - Base64 encoded PDF data
 * @param {string} fileName - Original filename
 * @returns {Promise<Array<{pageNumber: number, filePath: string, pdfContent: string}>>} - Array of page info
 */
export const splitPDFIntoPages = async (base64Data, fileName) => {
  try {
    // Remove data URL prefix if present
    let base64Content = base64Data;
    if (base64Data.includes(',')) {
      base64Content = base64Data.split(',')[1];
    }

    // Remove any whitespace that might cause issues
    base64Content = base64Content.trim().replace(/\s/g, '');

    // Convert base64 to buffer with validation
    let pdfBuffer;
    try {
      pdfBuffer = Buffer.from(base64Content, 'base64');
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('Failed to create buffer from base64 data');
      }
    } catch (bufferError) {
      console.error('Error converting base64 to buffer:', bufferError);
      throw new Error(`Failed to process PDF file: ${bufferError.message}`);
    }
    
    // Check file size before processing (limit to 80MB to avoid offset errors)
    const bufferSizeMB = pdfBuffer.length / (1024 * 1024);
    if (bufferSizeMB > 80) {
      throw new Error(`PDF file is ${bufferSizeMB.toFixed(2)}MB. File size exceeds 80MB limit. Please use a smaller file to avoid offset errors.`);
    }
    
    // Load the PDF document
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(pdfBuffer);
    } catch (loadError) {
      // Handle offset errors specifically for large files
      if (loadError.message && loadError.message.includes('offset')) {
        throw new Error('PDF file is too large or corrupted. Please try a smaller file or re-export the PDF.');
      }
      throw loadError;
    }
    const totalPages = pdfDoc.getPageCount();
    
    console.log(`Splitting PDF into ${totalPages} pages...`);
    
    const pages = [];
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').replace('.pdf', '');
    
    // Extract each page
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      // Create a new PDF document with just this page
      const newPdfDoc = await PDFDocument.create();
      try {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex]);
        newPdfDoc.addPage(copiedPage);
      } catch (copyError) {
        // Handle offset errors when copying pages
        if (copyError.message && copyError.message.includes('offset')) {
          console.error(`Offset error when copying page ${pageIndex + 1}. Stopping page extraction.`);
          break; // Stop processing remaining pages
        }
        throw copyError;
      }
      
      // Save the single-page PDF
      const pdfBytes = await newPdfDoc.save();
      const pageFileName = `${timestamp}_${sanitizedFileName}_page_${pageIndex + 1}.pdf`;
      const filePath = path.join(uploadsDir, pageFileName);
      
      fs.writeFileSync(filePath, pdfBytes);
      
      // Extract text from this page
      let pdfContent = '';
      try {
        const relativePath = `uploads/handbooks/${pageFileName}`;
        pdfContent = await extractTextFromPDF(relativePath);
      } catch (error) {
        console.error(`Failed to extract text from page ${pageIndex + 1}:`, error);
        // Continue even if extraction fails
      }
      
      pages.push({
        pageNumber: pageIndex + 1, // 1-indexed
        filePath: `uploads/handbooks/${pageFileName}`,
        pdfContent
      });
      
      console.log(`Extracted page ${pageIndex + 1}/${totalPages}`);
    }
    
    console.log(`Successfully split PDF into ${pages.length} pages`);
    return pages;
  } catch (error) {
    console.error('Error splitting PDF into pages:', error);
    throw new Error(`Failed to split PDF: ${error.message}`);
  }
};

