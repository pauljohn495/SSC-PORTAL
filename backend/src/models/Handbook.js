import mongoose from 'mongoose';

const handbookSchema = new mongoose.Schema({
  content: { type: String }, // Optional, kept for backward compatibility
  fileUrl: { type: String }, // Base64 encoded PDF (optional for backward compatibility)
  fileName: { type: String, default: '' },
  pdfContent: { type: String, default: '' }, // Extracted text content from PDF
  pageNumber: { type: Number }, // Optional, kept for backward compatibility with old handbooks
  // Google Drive fields
  googleDriveFileId: { type: String }, // Google Drive file ID
  googleDrivePreviewUrl: { type: String }, // Google Drive preview URL for PDF viewer
  status: { type: String, enum: ['draft', 'approved', 'rejected'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  archived: { type: Boolean, default: false },
  archivedAt: { type: Date },
  // Priority-based editing fields
  priorityEditor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priorityEditStartedAt: { type: Date },
  // Edit tracking fields
  editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  editedAt: { type: Date },
  version: { type: Number, default: 1 }
});

const Handbook = mongoose.model('Handbook', handbookSchema);

export default Handbook;

