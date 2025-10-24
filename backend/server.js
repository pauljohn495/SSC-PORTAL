import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '.env') });

import express from "express";
import cors from 'cors';
import mongoose from 'mongoose';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { User } from "./src/database/db.js";

const app = express();
const PORT = process.env.PORT || 5001;

// Admin emails exempted from domain rule
const adminEmails = ['johnpaultagalog@gmail.com', 'admin@student.buksu.edu.ph'];

// In-memory store for reset tokens (in production, use database)
const resetTokens = new Map();

app.use(cors());
app.use(express.json());

// Memorandum schema
const memorandumSchema = new mongoose.Schema({
  title: { type: String, required: true },
  year: { type: Number, required: true },
  fileUrl: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

const Memorandum = mongoose.model('Memorandum', memorandumSchema);

app.post('/api/auth/google', async (req, res) => {
  try {
    const { googleId, name, email, picture, recaptchaToken } = req.body;

    // Verify reCAPTCHA (in production, verify with Google)
    if (!recaptchaToken) {
      return res.status(400).json({ message: 'reCAPTCHA required' });
    }

    // Check if email domain is @student.buksu.edu.ph or is an admin email
    if (!email.endsWith('@student.buksu.edu.ph') && !adminEmails.includes(email)) {
      return res.status(403).json({ message: 'Only @student.buksu.edu.ph emails are allowed to login.' });
    }

    let user = await User.findOne({ googleId });

    if (!user) {
      const role = adminEmails.includes(email) ? 'admin' : 'student';
      user = new User({ googleId, name, email, picture, role });
      await user.save();
    } else {
      // Update role if email is admin
      if (adminEmails.includes(email) && user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
      }
    }
    res.status(200).json({ message: 'User authenticated', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/auth/admin', async (req, res) => {
  try {
    const { username, password, recaptchaToken } = req.body;

    // Verify reCAPTCHA (in production, verify with Google)
    if (!recaptchaToken) {
      return res.status(400).json({ message: 'reCAPTCHA required' });
    }

    if (username === 'admin' && password === 'admin123') {
      const user = {
        name: 'Admin',
        email: 'johnpaultagalog@gmail.com',
        role: 'admin',
        picture: '' // No picture for manual login
      };
      res.status(200).json({ message: 'Admin authenticated', user });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!adminEmails.includes(email)) {
      return res.status(400).json({ message: 'Only admin email is allowed for password reset.' });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const expiry = Date.now() + 3600000; // 1 hour

    resetTokens.set(resetCode, { email, expiry });

    // Send email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Reset Code',
      text: `Your password reset code is: ${resetCode}. Use this code to reset your password at http://localhost:5173/reset-password`
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Password reset code sent to your email.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password endpoint
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { code, newPassword } = req.body;

    const tokenData = resetTokens.get(code);
    if (!tokenData || tokenData.expiry < Date.now()) {
      return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    // In a real app, update password in database
    // For now, just remove code
    resetTokens.delete(code);

    res.status(200).json({ message: 'Password reset successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all memorandums
app.get('/api/memorandums', async (req, res) => {
  try {
    const memorandums = await Memorandum.find().sort({ year: -1, uploadedAt: -1 });
    res.status(200).json(memorandums);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => {
    console.log("Server started on port", PORT);
});

