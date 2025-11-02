import mongoose from 'mongoose';

const handbookSchema = new mongoose.Schema({
  content: { type: String, required: true },
  pageNumber: { type: Number, required: true, unique: true },
  status: { type: String, enum: ['draft', 'approved', 'rejected'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
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

