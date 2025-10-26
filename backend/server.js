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
import { User, Handbook, Memorandum } from "./src/database/db.js";

const app = express();
const PORT = process.env.PORT || 5001;

// Admin emails exempted from domain rule
let adminEmails = ['johnpaultagalog@gmail.com', 'admin@student.buksu.edu.ph'];

// In-memory store for reset tokens (in production, use database)
const resetTokens = new Map();

app.use(cors());
app.use(express.json());

// President emails (for assigning president role)
const presidentEmails = ['president@student.buksu.edu.ph']; // Add actual president emails here

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
      let role = 'student';
      if (adminEmails.includes(email)) {
        role = 'admin';
      } else if (presidentEmails.includes(email)) {
        role = 'president';
      }
      user = new User({ googleId, name, email, picture, role });
      await user.save();
    } else {
      // Update role if email is admin or president
      if (adminEmails.includes(email) && user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
      } else if (presidentEmails.includes(email) && user.role !== 'president') {
        user.role = 'president';
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

    console.log('Admin login attempt:', { username, password: '***', recaptchaToken: recaptchaToken ? 'present' : 'missing' });

    // Verify reCAPTCHA (in production, verify with Google)
    if (!recaptchaToken) {
      return res.status(400).json({ message: 'reCAPTCHA required' });
    }

    // Check database for admin user
    console.log('Looking for user with:', { username, password: '***', role: 'admin' });
    
    // First, let's find the user by username and role only
    const userByUsername = await User.findOne({ username, role: 'admin' });
    console.log('User found by username and role:', userByUsername ? 'Yes' : 'No');
    
    if (userByUsername) {
      console.log('Stored password:', userByUsername.password);
      console.log('Provided password:', password);
      console.log('Passwords match:', userByUsername.password === password);
      
      // Check if passwords match (with trimming to handle whitespace issues)
      if (userByUsername.password && userByUsername.password.trim() === password.trim()) {
        console.log('Admin authenticated successfully:', userByUsername.name);
        res.status(200).json({ message: 'Admin authenticated', user: userByUsername });
        return;
      }
    }
    
    const user = await User.findOne({ username, password, role: 'admin' });
    console.log('Database query result:', user ? 'User found' : 'User not found');
    
    if (user) {
      console.log('Admin authenticated successfully:', user.name);
      res.status(200).json({ message: 'Admin authenticated', user });
      return;
    }

    // Fallback to default admin
    if (username === 'admin' && password === 'admin123') {
      console.log('Using default admin credentials');
      const defaultUser = {
        name: 'Admin',
        email: 'johnpaultagalog@gmail.com',
        role: 'admin',
        picture: '' // No picture for manual login
      };
      res.status(200).json({ message: 'Admin authenticated', user: defaultUser });
    } else {
      console.log('Invalid credentials provided');
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Admin login error:', error);
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

// Get all approved memorandums (public)
app.get('/api/memorandums', async (req, res) => {
  try {
    const memorandums = await Memorandum.find({ status: 'approved' }).sort({ year: -1, uploadedAt: -1 });
    res.status(200).json(memorandums);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all memorandum drafts (for admin)
app.get('/api/admin/memorandums', async (req, res) => {
  try {
    const memorandums = await Memorandum.find().populate('createdBy', 'name email').sort({ uploadedAt: -1 });
    res.status(200).json(memorandums);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve or reject memorandum (admin only)
app.put('/api/admin/memorandums/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const memorandum = await Memorandum.findByIdAndUpdate(id, { status }, { new: true });
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    res.status(200).json({ message: `Memorandum ${status}`, memorandum });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload memorandum draft (president only)
app.post('/api/memorandums', async (req, res) => {
  try {
    const { title, year, fileUrl, userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can upload memorandum drafts' });
    }

    const memorandum = new Memorandum({ title, year, fileUrl, createdBy: userId });
    await memorandum.save();

    res.status(201).json({ message: 'Memorandum draft uploaded', memorandum });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all handbook pages (public, approved only)
app.get('/api/handbook', async (req, res) => {
  try {
    const handbook = await Handbook.find({ status: 'approved' }).sort({ createdAt: -1 });
    res.status(200).json(handbook);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all handbook drafts (for admin)
app.get('/api/admin/handbook', async (req, res) => {
  try {
    const handbook = await Handbook.find().populate('createdBy', 'name email').sort({ createdAt: -1 });
    res.status(200).json(handbook);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve or reject handbook page (admin only)
app.put('/api/admin/handbook/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const handbook = await Handbook.findByIdAndUpdate(id, { status }, { new: true });
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook page not found' });
    }

    res.status(200).json({ message: `Handbook page ${status}`, handbook });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create handbook page draft (president only)
app.post('/api/handbook', async (req, res) => {
  try {
    const { title, content, userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can create handbook drafts' });
    }

    const handbook = new Handbook({ title, content, createdBy: userId });
    await handbook.save();

    res.status(201).json({ message: 'Handbook draft created', handbook });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test endpoint to verify the fix is working
app.get('/api/admin/test-fix', async (req, res) => {
  try {
    const testEmail = '2301102187@student.buksu.edu.ph';
    console.log('Testing fix for email:', testEmail);
    
    const existingUser = await User.findOne({ email: testEmail });
    if (existingUser) {
      res.status(200).json({ 
        message: 'Fix is working - user found', 
        user: {
          email: existingUser.email,
          role: existingUser.role,
          name: existingUser.name
        }
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Test error:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Add president email (admin only)
app.post('/api/admin/add-president', async (req, res) => {
  try {
    const { email } = req.body;
    console.log('Add president request:', { email });

    if (!email || !email.includes('@')) {
      return res.status(400).json({ message: 'Valid email required' });
    }

    // Check if email already exists in database
    console.log('Checking for existing user with email:', email);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('User already exists:', {
        _id: existingUser._id,
        email: existingUser.email,
        role: existingUser.role,
        googleId: existingUser.googleId,
        name: existingUser.name
      });
      
      // If user exists and is already a president, return success
      if (existingUser.role === 'president') {
        return res.status(200).json({ 
          message: 'User is already a president', 
          user: existingUser 
        });
      }
      
      // If user exists but is not a president, update their role
      console.log(`Updating existing user ${email} from ${existingUser.role} to president`);
      existingUser.role = 'president';
      await existingUser.save();
      
      // Add to presidentEmails array if not already there
      if (!presidentEmails.includes(email)) {
        presidentEmails.push(email);
        console.log('Added to presidentEmails array:', email);
      }
      
      return res.status(200).json({ 
        message: `User role updated from ${existingUser.role} to president`, 
        user: existingUser 
      });
    }

    // Create new president user in database
    console.log('Creating new president user...');
    const newPresident = new User({
      email,
      role: 'president',
      googleId: undefined  // Explicitly set to undefined to avoid null conflict
    });
    
    console.log('Saving user to database...');
    await newPresident.save();
    console.log('User saved successfully:', newPresident);

    if (!presidentEmails.includes(email)) {
      presidentEmails.push(email);
      console.log('Added to presidentEmails array:', email);
    }

    res.status(200).json({ message: 'President email added successfully', user: newPresident });
  } catch (error) {
    console.error('Error in add-president endpoint:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Cleanup duplicate googleId entries and fix index (admin only)
app.post('/api/admin/cleanup-duplicates', async (req, res) => {
  try {
    console.log('Cleaning up duplicate googleId entries...');
    
    // Drop the problematic googleId index
    try {
      await User.collection.dropIndex('googleId_1');
      console.log('Dropped googleId_1 index');
    } catch (indexError) {
      console.log('Index might not exist or already dropped:', indexError.message);
    }
    
    // Find all users with null googleId
    const usersWithNullGoogleId = await User.find({ googleId: null });
    console.log('Found users with null googleId:', usersWithNullGoogleId.length);
    
    // Remove all but the first one
    if (usersWithNullGoogleId.length > 1) {
      const idsToDelete = usersWithNullGoogleId.slice(1).map(user => user._id);
      await User.deleteMany({ _id: { $in: idsToDelete } });
      console.log('Deleted duplicate users:', idsToDelete.length);
    }
    
    // Recreate the index with proper sparse configuration
    try {
      await User.collection.createIndex({ googleId: 1 }, { sparse: true, unique: true });
      console.log('Recreated googleId index with sparse: true, unique: true');
    } catch (indexError) {
      console.log('Error recreating index:', indexError.message);
    }
    
    res.status(200).json({ 
      message: 'Cleanup completed', 
      deleted: usersWithNullGoogleId.length > 1 ? usersWithNullGoogleId.length - 1 : 0 
    });
  } catch (error) {
    console.error('Error in cleanup:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Update user role (admin only) - TEMPORARY DEBUG ENDPOINT
app.post('/api/admin/update-user-role', async (req, res) => {
  try {
    const { email, newRole } = req.body;
    console.log('Update user role request:', { email, newRole });

    if (!email || !newRole) {
      return res.status(400).json({ message: 'Email and new role are required' });
    }

    console.log('Looking for user with email:', email);
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', {
      email: user.email,
      currentRole: user.role,
      name: user.name
    });

    const oldRole = user.role;
    user.role = newRole;
    
    console.log('Saving user with new role...');
    await user.save();
    console.log('User saved successfully');

    console.log(`Updated user ${email} from ${oldRole} to ${newRole}`);

    res.status(200).json({ 
      message: `User role updated from ${oldRole} to ${newRole}`,
      user: {
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Error updating user role:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Debug endpoint to list all users (admin only) - TEMPORARY
app.get('/api/admin/debug-users', async (req, res) => {
  try {
    const allUsers = await User.find({});
    const userSummary = allUsers.map(user => ({
      _id: user._id,
      email: user.email,
      role: user.role,
      googleId: user.googleId,
      name: user.name,
      username: user.username
    }));
    
    res.status(200).json({ 
      message: 'All users retrieved', 
      count: allUsers.length,
      users: userSummary 
    });
  } catch (error) {
    console.error('Error retrieving users:', error);
    res.status(500).json({ message: 'Server error', details: error.message });
  }
});

// Add manual admin account (admin only)
app.post('/api/admin/add-admin', async (req, res) => {
  try {
    const { username, password, name, email } = req.body;

    console.log('Creating admin account:', { username, name, email, password: '***' });

    if (!username || !password || !name || !email) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if username already exists in database
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      console.log('Username already exists:', username);
      return res.status(400).json({ message: 'Username already exists' });
    }

    // Create new admin user in database
    const newAdmin = new User({
      username,
      password, // In production, hash the password
      name,
      email,
      role: 'admin'
    });
    await newAdmin.save();

    console.log('Admin account created successfully:', newAdmin._id);

    // Add the email to adminEmails array for password reset
    if (!adminEmails.includes(email)) {
      adminEmails.push(email);
    }

    res.status(201).json({ message: 'Admin account created successfully', user: newAdmin });
  } catch (error) {
    console.error('Error creating admin account:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (admin only)
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Debug endpoint to check admin users (temporary)
app.get('/api/debug/admin-users', async (req, res) => {
  try {
    const adminUsers = await User.find({ role: 'admin' }).select('username name email role createdAt');
    console.log('Admin users in database:', adminUsers);
    res.status(200).json(adminUsers);
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Debug endpoint to check specific admin user with password (temporary)
app.get('/api/debug/admin-user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username, role: 'admin' });
    console.log('Admin user details:', user);
    res.status(200).json(user);
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(PORT, () => {
    console.log("Server started on port", PORT);
});

