import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true, unique: true }, // Allow null for manual admins, but unique when present
  name: String,
  email: { type: String, unique: true }, // Make email unique
  picture: String,
  username: { type: String, unique: true, sparse: true }, // For manual admin login, unique when present
  password: String, // For manual admin login
  role: { type: String, default: 'student' },
  resetToken: String,
  resetTokenExpiry: Date
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// Handbook schema
const handbookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
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

// Memorandum schema (updated with status)
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

// Activity Log schema
const activityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., 'login', 'handbook_create', 'memorandum_upload', 'user_approve', etc.
  description: { type: String, required: true }, // Human-readable description
  details: { type: mongoose.Schema.Types.Mixed }, // Additional data (optional)
  ipAddress: String, // User's IP address
  userAgent: String, // User's browser info
  timestamp: { type: Date, default: Date.now }
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export { User, Handbook, Memorandum, ActivityLog };
