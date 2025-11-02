import User from '../models/User.js';
import { logActivity } from '../utils/activityLogger.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import mongoose from 'mongoose';

// Verify reCAPTCHA token
const verifyRecaptcha = async (token) => {
  // In development mode without secret key, skip verification
  if (config.nodeEnv === 'development' && !config.recaptcha.secretKey) {
    console.log('Skipping reCAPTCHA verification in development mode');
    return true;
  }

  if (!token) {
    return false;
  }

  // If no secret key is configured, skip verification
  if (!config.recaptcha.secretKey) {
    console.warn('reCAPTCHA secret key not configured, skipping verification');
    return true;
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${config.recaptcha.secretKey}&response=${token}`
    });

    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    // In development, allow login even if verification fails
    if (config.nodeEnv === 'development') {
      return true;
    }
    return false;
  }
};

// Google OAuth login
export const googleAuth = async (req, res, next) => {
  try {
    const { email, name, picture, googleId, recaptchaToken } = req.body;

    // Verify reCAPTCHA token if provided
    if (recaptchaToken && recaptchaToken !== 'null' && recaptchaToken !== '') {
      const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidRecaptcha) {
        // In development mode, allow login even if reCAPTCHA fails
        if (config.nodeEnv !== 'development') {
          return res.status(401).json({ message: 'reCAPTCHA verification failed' });
        }
      }
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name, picture, googleId, role: 'student' });
      await user.save();
    } else {
      // Update user info if missing or changed
      if (googleId && !user.googleId) {
        user.googleId = googleId;
      }
      if (name && !user.name) {
        user.name = name;
      }
      if (picture && !user.picture) {
        user.picture = picture;
      }
      // IMPORTANT: Preserve existing role (don't overwrite admin/president roles)
      // Only set role to 'student' if user doesn't have a role yet
      if (!user.role) {
        user.role = 'student';
      }
      await user.save();
    }

    await logActivity(user._id, 'login', `User logged in via Google OAuth`, { 
      email: user.email, 
      name: user.name 
    }, req);

    // Return user object with all necessary fields
    const userResponse = {
      _id: user._id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      picture: user.picture,
      googleId: user.googleId
    };

    res.json({ user: userResponse });
  } catch (error) {
    next(error);
  }
};

// Admin login (only admins can manually login - presidents use Google OAuth)
export const adminLogin = async (req, res, next) => {
  try {
    // Check database connection first
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database connection unavailable. Please try again.' });
    }
    
    const { email, password, username, recaptchaToken } = req.body;

    // Verify reCAPTCHA token if provided
    if (recaptchaToken && recaptchaToken !== 'null' && recaptchaToken !== '') {
      const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidRecaptcha) {
        // In development mode, allow login even if reCAPTCHA fails
        if (config.nodeEnv !== 'development') {
          return res.status(401).json({ message: 'reCAPTCHA verification failed' });
        }
      }
    }

    let user;
    // Only admins can manually login - presidents must use Google OAuth
    if (email) {
      user = await User.findOne({ email, role: 'admin' });
    } else if (username) {
      user = await User.findOne({ username, role: 'admin' });
    } else {
      return res.status(400).json({ message: 'Email or username is required' });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user has a password set
    if (!user.password) {
      return res.status(401).json({ message: 'Account does not have a password set. Please contact administrator.' });
    }

    // Check password
    if (user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    await logActivity(user._id, 'admin_login', `Admin logged in manually`, { 
      email: user.email,
      username: user.username 
    }, req);

    // Return user object with all necessary fields
    const userResponse = {
      _id: user._id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: 'admin',
      picture: user.picture,
      googleId: user.googleId
    };

    res.json({ user: userResponse });
  } catch (error) {
    console.error('Admin login error:', error);
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

