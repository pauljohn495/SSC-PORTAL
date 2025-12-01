import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/index.js';
import { extractTextFromPDF } from './pdfExtractor.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true
});

/**
 * Upload a PDF file to Cloudinary
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} fileName - Name of the file
 * @param {string} folder - Optional folder path in Cloudinary
 * @returns {Promise<{publicId: string, url: string, secureUrl: string, previewUrl: string}>}
 */
export const uploadPDFToCloudinary = async (pdfBuffer, fileName, folder = 'buksu-documents') => {
  try {
    // Convert buffer to base64 data URI
    const base64Data = pdfBuffer.toString('base64');
    const dataUri = `data:application/pdf;base64,${base64Data}`;

    // Clean up filename - remove .pdf extension if present (Cloudinary will add it back)
    let cleanFileName = fileName.replace(/\.pdf$/i, '');
    // Remove any double extensions
    cleanFileName = cleanFileName.replace(/\.pdf$/i, '');
    
    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, {
      resource_type: 'raw', // Use 'raw' for PDFs to preserve file format
      folder: folder,
      public_id: cleanFileName, // Public ID without extension
      format: 'pdf', // Cloudinary will add .pdf extension automatically
      overwrite: true,
      use_filename: false, // Don't use filename, use our public_id instead
      unique_filename: false,
      type: 'upload', // Ensure it's an upload type (publicly accessible)
      access_mode: 'public' // Make file publicly accessible
    });

    // Ensure public_id doesn't have .pdf extension (Cloudinary might add it)
    let storedPublicId = result.public_id;
    if (storedPublicId.endsWith('.pdf')) {
      storedPublicId = storedPublicId.replace(/\.pdf$/i, '');
    }

    // Use the actual secure_url from Cloudinary response - this is the most reliable
    // Cloudinary's secure_url includes the version and is guaranteed to work
    const previewUrl = result.secure_url;
    const viewerUrl = result.secure_url;

    return {
      publicId: storedPublicId, // Use cleaned publicId without .pdf extension
      url: result.url,
      secureUrl: result.secure_url,
      previewUrl: viewerUrl, // URL for viewing the PDF
      downloadUrl: previewUrl // URL for downloading the PDF
    };
  } catch (error) {
    console.error('Error uploading PDF to Cloudinary:', error);
    throw new Error(`Failed to upload PDF to Cloudinary: ${error.message}`);
  }
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<void>}
 */
export const deleteFileFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      return;
    }

    await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw'
    });
    console.log(`Deleted file ${publicId} from Cloudinary`);
  } catch (error) {
    // Handle "not found" errors gracefully
    if (error.message && (error.message.includes('not found') || error.message.includes('Invalid'))) {
      console.log(`File ${publicId} not found in Cloudinary (may have been already deleted)`);
      return;
    }
    console.error(`Error deleting file ${publicId} from Cloudinary:`, error.message || error);
  }
};

/**
 * Download a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Buffer>}
 */
export const downloadFileFromCloudinary = async (publicId) => {
  if (!publicId) {
    throw new Error('Public ID is required to download from Cloudinary');
  }

  try {
    // Clean up publicId - remove .pdf extension if present (Cloudinary adds it automatically)
    // Also handle cases where publicId might have .pdf.pdf (double extension)
    let cleanPublicId = publicId.replace(/\.pdf$/i, '').replace(/\.pdf$/i, '');
    
    // Get the secure URL for the file
    // Note: publicId should include folder path if file was uploaded to a folder
    // e.g., 'handbook-sections/filename' not just 'filename'
    // Don't specify format - let Cloudinary handle it based on the file
    const url = cloudinary.url(cleanPublicId, {
      resource_type: 'raw',
      secure: true,
      // Don't add format: 'pdf' - let Cloudinary use the actual file format
    });

    // Fetch the file
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        // Try with .pdf extension explicitly
        const urlWithPdf = cloudinary.url(`${cleanPublicId}.pdf`, {
          resource_type: 'raw',
          secure: true,
        });
        const response2 = await fetch(urlWithPdf);
        if (response2.ok) {
          const arrayBuffer = await response2.arrayBuffer();
          return Buffer.from(arrayBuffer);
        }
        throw new Error(`File not found in Cloudinary (publicId: ${cleanPublicId}). The file may not have been uploaded yet.`);
      }
      throw new Error(`Failed to download file from Cloudinary: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    // Re-throw with more context if it's already our error
    if (error.message.includes('Cloudinary')) {
      throw error;
    }
    console.error('Error downloading file from Cloudinary:', error);
    throw new Error(`Failed to download file from Cloudinary: ${error.message}`);
  }
};

/**
 * Extract text from PDF buffer (for search indexing)
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @returns {Promise<string>}
 */
export const extractTextFromPDFBuffer = async (pdfBuffer) => {
  try {
    // Convert buffer to base64 for the extractor
    const base64Data = pdfBuffer.toString('base64');
    const dataUrl = `data:application/pdf;base64,${base64Data}`;
    return await extractTextFromPDF(dataUrl);
  } catch (error) {
    console.error('Error extracting text from PDF buffer:', error);
    return '';
  }
};

/**
 * Get Cloudinary URL for viewing a PDF
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Optional transformation options
 * @returns {string}
 */
export const getCloudinaryViewerUrl = (publicId, options = {}) => {
  if (!publicId) {
    return '';
  }

  return cloudinary.url(publicId, {
    resource_type: 'raw',
    format: 'pdf',
    secure: true,
    ...options
  });
};

