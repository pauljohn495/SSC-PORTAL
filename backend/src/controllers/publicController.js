import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import Notification from '../models/Notification.js';
import HandbookSection from '../models/HandbookSection.js';
import { getDepartments } from '../data/departments.js';
import { getFirebaseAdmin } from '../config/firebaseAdmin.js';
import User from '../models/User.js';
import { readPDFFromFile } from '../utils/fileStorage.js';
import { PDFDocument } from 'pdf-lib';
import { downloadFileFromDrive } from '../utils/googleDrive.js';

// Get all approved handbooks
export const getPublicHandbooks = async (req, res, next) => {
  try {
    const handbooks = await Handbook.find({ status: 'approved', archived: { $ne: true } }).sort({ pageNumber: 1 });
    
    // Extract PDF content for handbooks that don't have it yet
    for (const handbook of handbooks) {
      if (!handbook.pdfContent && handbook.fileUrl && !handbook.fileUrl.startsWith('data:')) {
        try {
          const { extractTextFromPDF } = await import('../utils/pdfExtractor.js');
          handbook.pdfContent = await extractTextFromPDF(handbook.fileUrl);
          await handbook.save();
          
          // Update Algolia index with new pdfContent
          try {
            const { saveHandbookToAlgolia } = await import('../services/algoliaService.js');
            await saveHandbookToAlgolia(handbook);
          } catch (algoliaError) {
            console.error(`Failed to update Algolia for handbook ${handbook._id}:`, algoliaError);
            // Continue even if Algolia update fails
          }
        } catch (error) {
          console.error(`Failed to extract PDF content for handbook ${handbook._id}:`, error);
          // Continue even if extraction fails
        }
      }
    }
    
    res.json(handbooks);
  } catch (error) {
    next(error);
  }
};

export const getDepartmentsCatalog = (req, res) => {
  res.json(getDepartments());
};

// Get all approved memorandums
export const getPublicMemorandums = async (req, res, next) => {
  try {
    const memorandums = await Memorandum.find({ status: 'approved', archived: { $ne: true } }).sort({ uploadedAt: -1 });
    res.json(memorandums);
  } catch (error) {
    next(error);
  }
};

// Get all published notifications (optionally filtered by department)
export const getPublicNotifications = async (req, res, next) => {
  try {
    const { department } = req.query;
    const baseFilter = { published: true };
    if (department) {
      const trimmedDepartment = department.trim();
      baseFilter.$or = [
        { targetScope: 'all' },
        {
          targetScope: 'departments',
          targetDepartments: trimmedDepartment
        }
      ];
    }

    const notifications = await Notification.find(baseFilter)
      .populate('createdBy', 'name email')
      .sort({ publishedAt: -1 });
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

// Get published handbook sidebar sections
export const getPublicHandbookSections = async (req, res, next) => {
  try {
    const sections = await HandbookSection.find({ published: true, status: 'approved' })
      .sort({ order: 1, createdAt: 1 });
    res.json(sections);
  } catch (error) {
    next(error);
  }
};

// Send a test push notification to a user by userId
export const sendTestPush = async (req, res, next) => {
  try {
    const { userId, title, body } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const user = await User.findById(userId);
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      return res.status(404).json({ message: 'User has no registered FCM tokens' });
    }

    const admin = getFirebaseAdmin();
    const message = {
      data: { title: String(title || 'Test notification'), body: String(body || 'Hello from server') },
      tokens: user.fcmTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    res.json({ successCount: response.successCount, failureCount: response.failureCount, responses: response.responses });
  } catch (error) {
    next(error);
  }
};

// Download specific page(s) from handbook
export const downloadHandbookPage = async (req, res, next) => {
  try {
    const { handbookId } = req.params;
    const { page } = req.query; // Page number (1-indexed) or comma-separated range like "1,3,5" or "1-5"

    if (!handbookId) {
      return res.status(400).json({ message: 'Handbook ID is required' });
    }

    const handbook = await Handbook.findById(handbookId);
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    if (handbook.status !== 'approved' || handbook.archived) {
      return res.status(403).json({ message: 'Handbook is not available' });
    }

    // Get file path
    let pdfBuffer;
    if (handbook.fileUrl && !handbook.fileUrl.startsWith('data:')) {
      // File path
      pdfBuffer = readPDFFromFile(handbook.fileUrl);
    } else if (handbook.fileUrl && handbook.fileUrl.startsWith('data:')) {
      // Base64 (backward compatibility)
      const base64Data = handbook.fileUrl.split(',')[1];
      pdfBuffer = Buffer.from(base64Data, 'base64');
    } else {
      return res.status(404).json({ message: 'Handbook PDF not found' });
    }

    // Load PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const totalPages = pdfDoc.getPageCount();

    // Parse page parameter
    let pagesToExtract = [];
    if (!page) {
      // If no page specified, return all pages
      pagesToExtract = Array.from({ length: totalPages }, (_, i) => i);
    } else {
      // Parse page numbers (1-indexed, convert to 0-indexed)
      const pageStr = String(page).trim();
      
      if (pageStr.includes(',')) {
        // Multiple pages: "1,3,5"
        pagesToExtract = pageStr.split(',').map(p => {
          const num = parseInt(p.trim()) - 1;
          if (num < 0 || num >= totalPages) throw new Error(`Invalid page number: ${p.trim()}`);
          return num;
        });
      } else if (pageStr.includes('-')) {
        // Range: "1-5"
        const [start, end] = pageStr.split('-').map(p => parseInt(p.trim()) - 1);
        if (start < 0 || end >= totalPages || start > end) {
          throw new Error(`Invalid page range: ${pageStr}`);
        }
        pagesToExtract = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      } else {
        // Single page
        const pageNum = parseInt(pageStr) - 1;
        if (pageNum < 0 || pageNum >= totalPages) {
          return res.status(400).json({ message: `Invalid page number. Handbook has ${totalPages} pages.` });
        }
        pagesToExtract = [pageNum];
      }
    }

    // Create new PDF with selected pages
    const newPdfDoc = await PDFDocument.create();
    
    // Copy pages in order
    for (const pageIndex of pagesToExtract) {
      try {
        const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageIndex]);
        newPdfDoc.addPage(copiedPage);
      } catch (copyError) {
        console.error(`Error copying page ${pageIndex + 1}:`, copyError);
        throw new Error(`Failed to extract page ${pageIndex + 1}`);
      }
    }

    // Generate PDF bytes (returns Uint8Array)
    const pdfBytes = await newPdfDoc.save();
    
    // Validate PDF bytes
    if (!pdfBytes || pdfBytes.length === 0) {
      throw new Error('Generated PDF is empty');
    }
    
    // Verify PDF header (PDF files start with %PDF)
    const pdfHeader = Buffer.from(pdfBytes.slice(0, 4)).toString('ascii');
    if (!pdfHeader.startsWith('%PDF')) {
      console.error('Invalid PDF header:', pdfHeader);
      throw new Error('Generated PDF is corrupted');
    }

    // Set response headers
    const pageLabel = pagesToExtract.length === 1 
      ? `page-${pagesToExtract[0] + 1}` 
      : `pages-${pagesToExtract[0] + 1}-${pagesToExtract[pagesToExtract.length - 1] + 1}`;
    const fileName = handbook.fileName 
      ? handbook.fileName.replace('.pdf', `-${pageLabel}.pdf`)
      : `handbook-${pageLabel}.pdf`;

    // Convert Uint8Array to Buffer for proper binary response
    const responseBuffer = Buffer.from(pdfBytes);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', responseBuffer.length);
    res.send(responseBuffer);
  } catch (error) {
    console.error('Error extracting handbook page:', error);
    if (error.message.includes('Invalid page')) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

const fetchPdfBufferFromUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
};

export const streamHandbookFile = async (req, res, next) => {
  try {
    const { handbookId } = req.params;
    if (!handbookId) {
      return res.status(400).json({ message: 'Handbook ID is required' });
    }

    const handbook = await Handbook.findById(handbookId);
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    if (handbook.status !== 'approved' || handbook.archived) {
      return res.status(403).json({ message: 'Handbook is not available' });
    }

    let pdfBuffer = null;

    const fallbackFileName = handbook.fileName || 'student-handbook.pdf';

    if (handbook.googleDriveFileId) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${handbook.googleDriveFileId}`;
      pdfBuffer = await fetchPdfBufferFromUrl(downloadUrl);
    } else if (handbook.googleDrivePreviewUrl) {
      pdfBuffer = await fetchPdfBufferFromUrl(handbook.googleDrivePreviewUrl);
    } else if (handbook.fileUrl) {
      if (handbook.fileUrl.startsWith('data:')) {
        const base64Data = handbook.fileUrl.split(',')[1];
        pdfBuffer = Buffer.from(base64Data, 'base64');
      } else if (handbook.fileUrl.startsWith('http')) {
        pdfBuffer = await fetchPdfBufferFromUrl(handbook.fileUrl);
      } else {
        pdfBuffer = readPDFFromFile(handbook.fileUrl);
      }
    }

    if (!pdfBuffer) {
      return res.status(404).json({ message: 'Handbook PDF not available' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fallbackFileName)}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error streaming handbook file:', error);
    return next(error);
  }
};

export const streamHandbookSectionFile = async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    if (!sectionId) {
      return res.status(400).json({ message: 'Section ID is required' });
    }

    const section = await HandbookSection.findById(sectionId);
    if (!section) {
      return res.status(404).json({ message: 'Section not found' });
    }

    if (section.published === false || section.status !== 'approved') {
      return res.status(403).json({ message: 'Section is not available' });
    }

    let pdfBuffer = null;
    const ownerId = section.updatedBy?.toString() || section.createdBy?.toString();
    const fallbackFileName = section.title ? `${section.title}.pdf` : 'handbook-section.pdf';

    if (section.googleDriveFileId && ownerId) {
      try {
        pdfBuffer = await downloadFileFromDrive(section.googleDriveFileId, ownerId);
      } catch (error) {
        console.error(`Failed to download section ${sectionId} from Drive:`, error);
      }
    }

    if (!pdfBuffer && section.fileUrl) {
      if (section.fileUrl.startsWith('data:')) {
        const base64Data = section.fileUrl.split(',')[1];
        pdfBuffer = Buffer.from(base64Data, 'base64');
      } else if (section.fileUrl.startsWith('http')) {
        pdfBuffer = await fetchPdfBufferFromUrl(section.fileUrl);
      } else {
        pdfBuffer = readPDFFromFile(section.fileUrl);
      }
    }

    if (!pdfBuffer) {
      return res.status(404).json({ message: 'Section PDF not available' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fallbackFileName)}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error streaming handbook section file:', error);
    return next(error);
  }
};

