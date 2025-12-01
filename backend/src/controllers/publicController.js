import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import Notification from '../models/Notification.js';
import HandbookSection from '../models/HandbookSection.js';
import { getDepartments } from '../data/departments.js';
import { readPDFFromFile } from '../utils/fileStorage.js';
import { PDFDocument } from 'pdf-lib';
import { downloadFileFromCloudinary } from '../utils/cloudinary.js';
import { logActivity } from '../utils/activityLogger.js';
import { setApiLogHeader } from '../utils/apiLogger.js';

const logPublicApi = (req, res, endpoint, status, message, content) => {
  setApiLogHeader(res, {
    method: req?.method || 'GET',
    endpoint,
    status,
    message,
    content,
  });
};

// Get all approved handbooks
export const getPublicHandbooks = async (req, res, next) => {
  try {
    await logActivity('anonymous', 'VIEW_HANDBOOKS', 'Viewed all approved handbooks', null, req);
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
    
    logPublicApi(req, res, '/api/handbook', 200, 'Fetched approved handbooks', { count: handbooks.length });
    return res.json(handbooks);
  } catch (error) {
    logPublicApi(req, res, '/api/handbook', 500, 'Failed to fetch approved handbooks');
    next(error);
  }
};

export const getDepartmentsCatalog = (req, res) => {
  const departments = getDepartments();
  logPublicApi(req, res, '/api/departments', 200, 'Fetched departments catalog', { count: departments.length });
  return res.json(departments);
};

// Get all approved memorandums
export const getPublicMemorandums = async (req, res, next) => {
  try {
    await logActivity('anonymous', 'VIEW_MEMORANDUMS', 'Viewed all approved memorandums', null, req);
    const memorandums = await Memorandum.find({ status: 'approved', archived: { $ne: true } }).sort({ uploadedAt: -1 });
    logPublicApi(req, res, '/api/memorandums', 200, 'Fetched approved memorandums', { count: memorandums.length });
    return res.json(memorandums);
  } catch (error) {
    logPublicApi(req, res, '/api/memorandums', 500, 'Failed to fetch approved memorandums');
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
    await logActivity('anonymous', 'VIEW_NOTIFICATIONS', `Viewed published notifications${department ? ` for department: ${department}` : ''}`, null, req);
    logPublicApi(
      req,
      res,
      '/api/notifications',
      200,
      'Fetched published notifications',
      { count: notifications.length, department: department || 'all' }
    );
    return res.json(notifications);
  } catch (error) {
    logPublicApi(req, res, '/api/notifications', 500, 'Failed to fetch published notifications');
    next(error);
  }
};

// Get published handbook sidebar sections
export const getPublicHandbookSections = async (req, res, next) => {
  try {
    // Exclude large fields for faster response
    const sections = await HandbookSection.find(
      { published: true, status: 'approved', archived: { $ne: true } },
      { fileUrl: 0, pdfContent: 0 } // Exclude large fields
    )
      .sort({ order: 1, createdAt: 1 })
      .lean(); // Use lean() for faster queries
    
    logPublicApi(req, res, '/api/handbook-sections', 200, 'Fetched published handbook sections', { count: sections.length });
    res.json(sections);
    
    // Log activity in background (non-blocking)
    logActivity('anonymous', 'VIEW_HANDBOOK_SECTIONS', 'Viewed all published handbook sections', null, req)
      .catch(err => console.error('Background activity log failed:', err));
  } catch (error) {
    logPublicApi(req, res, '/api/handbook-sections', 500, 'Failed to fetch handbook sections');
    next(error);
  }
};

export const searchHandbookSections = async (req, res, next) => {
  try {
    const { query } = req.query;
    const searchTerm = typeof query === 'string' ? query.trim() : '';

    if (!searchTerm) {
      logPublicApi(req, res, '/api/handbook-sections/search', 400, 'Search query is required');
      return res.status(400).json({ message: 'Search query is required' });
    }

    await logActivity('anonymous', 'SEARCH_HANDBOOK_SECTIONS', `Searched handbook sections with query: "${searchTerm}"`, null, req);

    const normalized = searchTerm.toLowerCase();
    
    // Use regex for faster MongoDB text search with index
    const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    
    // First, find sections that contain the search term using MongoDB text search
    // This is faster than loading all sections and searching in memory
    const sections = await HandbookSection.find({
      published: true,
      status: 'approved',
      archived: { $ne: true },
      pdfContent: { $exists: true, $ne: '' },
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { pdfContent: searchRegex }
      ]
    })
    .select('title description pdfContent order')
    .lean() // Use lean() for faster queries (returns plain objects)
    .limit(50); // Limit results for performance

    const SNIPPET_RADIUS = 120;
    const MAX_SNIPPETS_PER_SECTION = 3;
    const results = [];

    // Process sections in parallel for better performance
    const processSection = (section) => {
      const content = section.pdfContent || '';
      if (!content) return null;
      
      const lowerContent = content.toLowerCase();
      let matchIndex = lowerContent.indexOf(normalized);
      
      if (matchIndex === -1) return null; // No match found
      
      const snippets = [];
      let safetyCounter = 0;

      while (matchIndex !== -1 && snippets.length < MAX_SNIPPETS_PER_SECTION && safetyCounter < 50) {
        const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
        const end = Math.min(content.length, matchIndex + normalized.length + SNIPPET_RADIUS);
        const rawSnippet = content.slice(start, end).replace(/\s+/g, ' ').trim();

        snippets.push({
          text: rawSnippet,
          matchIndex
        });

        matchIndex = lowerContent.indexOf(normalized, matchIndex + normalized.length);
        safetyCounter += 1;
      }

      if (snippets.length) {
        return {
          sectionId: section._id,
          title: section.title,
          description: section.description,
          order: section.order,
          snippets
        };
      }
      return null;
    };

    // Process sections and filter out null results
    sections.forEach((section) => {
      const result = processSection(section);
      if (result) {
        results.push(result);
      }
    });

    // Sort by order (or relevance if needed)
    results.sort((a, b) => (a.order || 0) - (b.order || 0));

    const responseBody = {
      query: searchTerm,
      results
    };

    logPublicApi(
      req,
      res,
      '/api/handbook-sections/search',
      200,
      'Handbook sections search completed',
      { query: searchTerm, matches: results.length }
    );

    return res.json(responseBody);
  } catch (error) {
    logPublicApi(req, res, '/api/handbook-sections/search', 500, 'Failed to search handbook sections');
    next(error);
  }
};

// Download specific page(s) from handbook
export const downloadHandbookPage = async (req, res, next) => {
  try {
    const endpoint = '/api/handbook/:handbookId/download-page';
    const { handbookId } = req.params;
    const { page } = req.query; // Page number (1-indexed) or comma-separated range like "1,3,5" or "1-5"

    if (!handbookId) {
      logPublicApi(req, res, endpoint, 400, 'Handbook ID is required');
      return res.status(400).json({ message: 'Handbook ID is required' });
    }

    await logActivity('anonymous', 'DOWNLOAD_HANDBOOK_PAGE', `Downloaded handbook pages: ${page || 'all'}`, handbookId, req);

    const handbook = await Handbook.findById(handbookId);
    if (!handbook) {
      logPublicApi(req, res, endpoint, 404, 'Handbook not found', { handbookId });
      return res.status(404).json({ message: 'Handbook not found' });
    }

    if (handbook.status !== 'approved' || handbook.archived) {
      logPublicApi(req, res, endpoint, 403, 'Handbook is not available', { handbookId });
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
      logPublicApi(req, res, endpoint, 404, 'Handbook PDF not found', { handbookId });
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
          logPublicApi(
            req,
            res,
            endpoint,
            400,
            `Invalid page number. Handbook has ${totalPages} pages.`,
            { handbookId, requestedPage: pageStr }
          );
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

    logPublicApi(
      req,
      res,
      endpoint,
      200,
      'Handbook pages ready for download',
      {
        handbookId,
        pagesRequested: page || 'all',
        totalPages: pagesToExtract.length,
      }
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', responseBuffer.length);
    res.send(responseBuffer);
  } catch (error) {
    console.error('Error extracting handbook page:', error);
    if (error.message.includes('Invalid page')) {
      logPublicApi(req, res, endpoint, 400, error.message, { handbookId: req.params.handbookId });
      return res.status(400).json({ message: error.message });
    }
    logPublicApi(req, res, endpoint, 500, 'Failed to download handbook pages');
    next(error);
  }
};

const fetchPdfBufferFromUrl = async (url, options = {}) => {
  const fetchOptions = {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...options.headers
    },
    ...options
  };
  
  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    throw new Error(`Failed to download PDF (${response.status})`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  // Validate it's a PDF by checking the header
  if (buffer.length < 4 || buffer.toString('ascii', 0, 4) !== '%PDF') {
    throw new Error('Downloaded content is not a valid PDF (invalid header)');
  }
  
  return buffer;
};

export const streamHandbookFile = async (req, res, next) => {
  try {
    const endpoint = '/api/handbook/:handbookId/file';
    const { handbookId } = req.params;
    if (!handbookId) {
      logPublicApi(req, res, endpoint, 400, 'Handbook ID is required');
      return res.status(400).json({ message: 'Handbook ID is required' });
    }

    await logActivity('anonymous', 'STREAM_HANDBOOK_FILE', 'Streamed handbook file', handbookId, req);

    const handbook = await Handbook.findById(handbookId);
    if (!handbook) {
      logPublicApi(req, res, endpoint, 404, 'Handbook not found', { handbookId });
      return res.status(404).json({ message: 'Handbook not found' });
    }

    if (handbook.status !== 'approved' || handbook.archived) {
      logPublicApi(req, res, endpoint, 403, 'Handbook is not available', { handbookId });
      return res.status(403).json({ message: 'Handbook is not available' });
    }

    // If we have a Cloudinary URL, redirect directly to it (more efficient and avoids auth issues)
    if (handbook.cloudinaryUrl && handbook.cloudinaryUrl.startsWith('http')) {
      const cleanUrl = handbook.cloudinaryUrl.split('?')[0]; // Remove query params
      logPublicApi(req, res, endpoint, 302, 'Redirecting to Cloudinary', { handbookId, url: cleanUrl });
      return res.redirect(302, cleanUrl);
    }

    let pdfBuffer = null;

    const fallbackFileName = handbook.fileName || 'student-handbook.pdf';

    // Try Cloudinary URL first (most reliable - it's the full URL)
    if (handbook.cloudinaryUrl && handbook.cloudinaryUrl.startsWith('http')) {
      try {
        pdfBuffer = await fetchPdfBufferFromUrl(handbook.cloudinaryUrl);
      } catch (error) {
        console.warn(`Failed to download handbook ${handbookId} from Cloudinary URL:`, error.message);
      }
    }
    
    // Fallback to publicId if cloudinaryUrl didn't work
    if (!pdfBuffer && handbook.cloudinaryPublicId) {
      try {
        pdfBuffer = await downloadFileFromCloudinary(handbook.cloudinaryPublicId);
      } catch (error) {
        console.warn(`Failed to download handbook ${handbookId} from Cloudinary using publicId:`, error.message);
      }
    }
    
    // Final fallback to fileUrl (for backward compatibility with old files)
    if (!pdfBuffer && handbook.fileUrl) {
      if (handbook.fileUrl.startsWith('data:')) {
        const base64Data = handbook.fileUrl.split(',')[1];
        pdfBuffer = Buffer.from(base64Data, 'base64');
      } else if (handbook.fileUrl.startsWith('http')) {
        try {
          pdfBuffer = await fetchPdfBufferFromUrl(handbook.fileUrl);
        } catch (error) {
          console.warn(`Failed to download handbook ${handbookId} from fileUrl:`, error.message);
        }
      } else {
        pdfBuffer = readPDFFromFile(handbook.fileUrl);
      }
    }

    if (!pdfBuffer) {
      logPublicApi(req, res, endpoint, 404, 'Handbook PDF not available', { handbookId });
      return res.status(404).json({ message: 'Handbook PDF not available' });
    }

    logPublicApi(req, res, endpoint, 200, 'Streaming handbook file', { handbookId, fileName: fallbackFileName });

    // Set cache headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fallbackFileName)}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error streaming handbook file:', error);
    logPublicApi(req, res, '/api/handbook/:handbookId/file', 500, 'Failed to stream handbook file');
    return next(error);
  }
};

export const streamHandbookSectionFile = async (req, res, next) => {
  try {
    const endpoint = '/api/handbook-sections/:sectionId/file';
    const { sectionId } = req.params;
    if (!sectionId) {
      logPublicApi(req, res, endpoint, 400, 'Section ID is required');
      return res.status(400).json({ message: 'Section ID is required' });
    }

    await logActivity('anonymous', 'STREAM_HANDBOOK_SECTION_FILE', 'Streamed handbook section file', sectionId, req);

    const section = await HandbookSection.findById(sectionId);
    if (!section) {
      logPublicApi(req, res, endpoint, 404, 'Section not found', { sectionId });
      return res.status(404).json({ message: 'Section not found' });
    }

    if (section.published === false || section.status !== 'approved') {
      logPublicApi(req, res, endpoint, 403, 'Section is not available', { sectionId });
      return res.status(403).json({ message: 'Section is not available' });
    }

    // If we have a Cloudinary URL, redirect directly to it (more efficient and avoids auth issues)
    if (section.cloudinaryUrl && section.cloudinaryUrl.startsWith('http')) {
      const cleanUrl = section.cloudinaryUrl.split('?')[0]; // Remove query params
      logPublicApi(req, res, endpoint, 302, 'Redirecting to Cloudinary', { sectionId, url: cleanUrl });
      return res.redirect(302, cleanUrl);
    }

    let pdfBuffer = null;
    const ownerId = section.updatedBy?.toString() || section.createdBy?.toString();
    const fallbackFileName = section.title ? `${section.title}.pdf` : 'handbook-section.pdf';

    // Try Cloudinary URL first (most reliable - it's the full URL)
    // Remove query parameters that might cause issues
    if (section.cloudinaryUrl && section.cloudinaryUrl.startsWith('http')) {
      try {
        // Remove query parameters from URL (like ?_a=BAMAMieC0) as they might be expired
        const cleanUrl = section.cloudinaryUrl.split('?')[0];
        pdfBuffer = await fetchPdfBufferFromUrl(cleanUrl);
      } catch (error) {
        // If cleaned URL fails, try original URL
        try {
          pdfBuffer = await fetchPdfBufferFromUrl(section.cloudinaryUrl);
        } catch (error2) {
          // Try without version number (remove /v\d+/ from URL)
          try {
            const urlWithoutVersion = section.cloudinaryUrl.replace(/\/v\d+\//, '/');
            pdfBuffer = await fetchPdfBufferFromUrl(urlWithoutVersion);
          } catch (error3) {
            // All attempts failed, continue to next fallback
          }
        }
      }
    }
    
    // Fallback to publicId if cloudinaryUrl didn't work
    if (!pdfBuffer && section.cloudinaryPublicId) {
      try {
        pdfBuffer = await downloadFileFromCloudinary(section.cloudinaryPublicId);
      } catch (error) {
        // Continue to next fallback
      }
    }

    // Final fallback to fileUrl (for backward compatibility with old files)
    if (!pdfBuffer && section.fileUrl) {
      if (section.fileUrl.startsWith('data:')) {
        try {
          const base64Data = section.fileUrl.split(',')[1];
          pdfBuffer = Buffer.from(base64Data, 'base64');
        } catch (error) {
          // Continue to next fallback
        }
      } else if (section.fileUrl.startsWith('http')) {
        try {
          pdfBuffer = await fetchPdfBufferFromUrl(section.fileUrl);
        } catch (error) {
          // Continue to next fallback
        }
      } else {
        try {
          pdfBuffer = readPDFFromFile(section.fileUrl);
        } catch (error) {
          // Continue to next fallback
        }
      }
    }

    if (!pdfBuffer) {
      logPublicApi(req, res, endpoint, 404, 'Section PDF not available - file may need to be re-uploaded', { sectionId });
      return res.status(404).json({ 
        message: 'Section PDF not available. The file may need to be re-uploaded to Cloudinary.',
        sectionId,
        details: 'File not found in any storage location. Please contact an administrator to re-upload this section.'
      });
    }

    logPublicApi(req, res, endpoint, 200, 'Streaming handbook section file', { sectionId, fileName: fallbackFileName });

    // Set cache headers with ETag for proper cache validation
    // Use section ID and updatedAt timestamp for cache validation
    const etag = `"${sectionId}-${section.updatedAt?.getTime() || section._id}"`;
    res.setHeader('ETag', etag);
    
    // Check if client has cached version
    if (req.headers['if-none-match'] === etag) {
      return res.status(304).end(); // Not Modified
    }
    
    // Support range requests for partial content (enables streaming and faster loading)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : pdfBuffer.length - 1;
      const chunksize = (end - start) + 1;
      const chunk = pdfBuffer.slice(start, end + 1);
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${pdfBuffer.length}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=300, must-revalidate',
        'X-Section-Id': sectionId,
        'X-File-Name': fallbackFileName
      });
      return res.end(chunk);
    }
    
    // Cache with validation - shorter max-age, must revalidate
    res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate'); // Cache for 5 minutes, must revalidate
    res.setHeader('Accept-Ranges', 'bytes'); // Enable range requests
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fallbackFileName)}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    // Add section ID to response for debugging
    res.setHeader('X-Section-Id', sectionId);
    res.setHeader('X-File-Name', fallbackFileName);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error streaming handbook section file:', error);
    logPublicApi(req, res, '/api/handbook-sections/:sectionId/file', 500, 'Failed to stream handbook section file');
    return next(error);
  }
};

