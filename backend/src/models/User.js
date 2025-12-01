import mongoose from 'mongoose';
import { hashPassword, comparePassword as comparePasswordHelper } from '../utils/security.js';

const userSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true, unique: true }, // Allow null for manual admins, but unique when present
  name: String,
  email: { type: String, unique: true }, // Make email unique
  picture: String,
  username: { type: String, unique: true, sparse: true }, // For manual admin login, unique when present
  password: String, // For manual admin login
  role: { type: String, default: 'student' },
  department: { type: String },
  course: { type: String },
  profileCompleted: { type: Boolean, default: false },
  resetToken: String,
  resetTokenExpiry: Date,
  setupToken: String,
  setupTokenExpiry: Date,
  archived: { type: Boolean, default: false },
  archivedAt: Date,
  // Google Calendar OAuth tokens (only for president role)
  googleCalendar: {
    accessToken: String,
    refreshToken: String,
    scope: String,
    tokenType: String,
    expiryDate: Number
  },
  // Google Drive OAuth tokens (only for president role)
  googleDrive: {
    accessToken: String,
    refreshToken: String,
    scope: String,
    tokenType: String,
    expiryDate: Number
  }
}, { timestamps: true });

const isBcryptHash = (value) => typeof value === 'string' && /^\$2[aby]\$/.test(value);

userSchema.pre('save', async function handlePasswordHash(next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }

  try {
    this.password = await hashPassword(this.password);
    return next();
  } catch (error) {
    return next(error);
  }
});

userSchema.methods.comparePassword = async function comparePasswordMethod(candidatePassword) {
  if (!this.password) {
    return false;
  }

  if (!isBcryptHash(this.password)) {
    const matches = this.password === candidatePassword;
    if (matches) {
      // Trigger hashing via pre-save hook so we migrate legacy plaintext passwords
      this.password = candidatePassword;
      await this.save();
    }
    return matches;
  }

  return comparePasswordHelper(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;

