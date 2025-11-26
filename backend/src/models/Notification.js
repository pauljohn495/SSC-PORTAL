import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  published: { type: Boolean, default: false },
  publishedAt: { type: Date },
  emailSent: { type: Boolean, default: false },
  targetScope: {
    type: String,
    enum: ['all', 'departments', 'range'],
    default: 'all'
  },
  targetDepartments: {
    type: [String],
    default: []
  },
  rangeStart: { type: String },
  rangeEnd: { type: String }
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;

