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

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(base64Content, 'base64');
    
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();
    
    console.log(`Splitting PDF into ${totalPages} pages...`);
    
    const pages = [];
    const timestamp = Date.now();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_').replace('.pdf', '');
    
    // Extract each page
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      // Create a new PDF document with just this page
      const newPdfDoc = await PDFDocument.create();
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex]);
      newPdfDoc.addPage(copiedPage);
      
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

