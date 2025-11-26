import mongoose from 'mongoose';

const policySectionSchema = new mongoose.Schema({
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'PolicyDepartment', required: true, index: true },
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true },
  description: { type: String, trim: true },
  filePath: { type: String, required: true },
  fileName: { type: String, trim: true },
  fileSize: { type: Number },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  rejectionReason: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: { type: Date },
  publishedAt: { type: Date }
}, { timestamps: true });

policySectionSchema.index({ department: 1, slug: 1 }, { unique: true });

const PolicySection = mongoose.model('PolicySection', policySectionSchema);

export default PolicySection;

