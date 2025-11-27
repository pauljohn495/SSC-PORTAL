import mongoose from 'mongoose';

const handbookSectionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, trim: true },
  order: { type: Number, default: 0 },
  fileName: { type: String },
  fileUrl: { type: String },
  googleDriveFileId: { type: String },
  googleDrivePreviewUrl: { type: String },
  pdfContent: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  published: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  version: { type: Number, default: 1 },
  archived: { type: Boolean, default: false },
  archivedAt: { type: Date },
  priorityEditor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priorityEditStartedAt: { type: Date },
}, { timestamps: true });

const HandbookSection = mongoose.model('HandbookSection', handbookSectionSchema);

export default HandbookSection;


