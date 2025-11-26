import mongoose from 'mongoose';

const policyDepartmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, trim: true },
  accessKey: { type: String, required: true, trim: true, unique: true },
  college: { type: String, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isArchived: { type: Boolean, default: false },
  version: { type: Number, default: 1 }
}, { timestamps: true });

policyDepartmentSchema.index({ name: 1 }, { unique: true });

const PolicyDepartment = mongoose.model('PolicyDepartment', policyDepartmentSchema);

export default PolicyDepartment;

