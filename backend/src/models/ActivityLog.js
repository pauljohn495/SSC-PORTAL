import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true }, // e.g., 'login', 'handbook_create', 'memorandum_upload', etc.
  description: { type: String, required: true }, // Human-readable description
  details: { type: mongoose.Schema.Types.Mixed }, // Additional data (optional)
  ipAddress: String, // User's IP address
  userAgent: String, // User's browser info
  timestamp: { type: Date, default: Date.now }
});

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;

