import User from '../models/User.js';
import { logActivity } from '../utils/activityLogger.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

// Google OAuth login
export const googleAuth = async (req, res, next) => {
  try {
    const { email, name, picture } = req.body;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name, picture, role: 'student' });
      await user.save();
    }

    await logActivity(user._id, 'login', `User logged in via Google OAuth`, { 
      email: user.email, 
      name: user.name 
    }, req);

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

// Admin login
export const adminLogin = async (req, res, next) => {
  try {
    const { email, password, username } = req.body;

    let user;
    if (email) {
      user = await User.findOne({ email, role: 'admin' });
    } else if (username) {
      user = await User.findOne({ username, role: 'admin' });
    }
    
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    await logActivity(user._id, 'admin_login', `Admin logged in manually`, { 
      email: user.email 
    }, req);

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

// Forgot password
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'If that email exists in our system, a password reset link has been sent.' });
    }

    if (user.role !== 'admin') {
      return res.json({ message: 'If that email exists in our system, a password reset link has been sent.' });
    }

    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.email.user || 'your-email@gmail.com',
        pass: config.email.pass || 'your-app-password'
      }
    });

    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: config.email.user || 'your-email@gmail.com',
      to: email,
      subject: 'Password Reset Request - BUKSU - SSC',
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your admin account.</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>If you didn't request this, please ignore this email.</p>
      `
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log('Password reset email sent to:', email);
      res.json({ message: 'Password reset email has been sent to your email address.' });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      console.log('PASSWORD RESET LINK (Email failed):');
      console.log('Email:', email);
      console.log('Reset URL:', resetUrl);
      console.log('Reset Token:', resetToken);
      
      res.json({ 
        message: 'Email could not be sent, but here is your password reset link (also check server console):',
        resetUrl,
        resetToken
      });
    }
  } catch (error) {
    next(error);
  }
};

// Reset password
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    const user = await User.findOne({ 
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    next(error);
  }
};

