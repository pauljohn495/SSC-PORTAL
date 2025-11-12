import mongoose from 'mongoose';

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
  fcmTokens: { type: [String], default: [] },
  // Google Calendar OAuth tokens (only for president role)
  googleCalendar: {
    accessToken: String,
    refreshToken: String,
    scope: String,
    tokenType: String,
    expiryDate: Number
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;

