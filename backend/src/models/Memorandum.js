import mongoose from 'mongoose';

const memorandumSchema = new mongoose.Schema({
  title: { type: String, required: true },
  year: { type: Number, required: true },
  fileUrl: { type: String, required: true },
  status: { type: String, enum: ['draft', 'approved', 'rejected'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now },
  // Priority-based editing fields
  priorityEditor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  priorityEditStartedAt: { type: Date },
  // Edit tracking fields
  editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  editedAt: { type: Date },
  version: { type: Number, default: 1 }
});

const Memorandum = mongoose.model('Memorandum', memorandumSchema);

export default Memorandum;

