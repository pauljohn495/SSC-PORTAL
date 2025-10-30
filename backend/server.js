import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { User, Handbook, Memorandum, ActivityLog } from './src/database/db.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// MongoDB connection
mongoose.connect('mongodb+srv://2301102187_db_user:V04dFoI1ZvOcjsdX@buksu.pdd0zsh.mongodb.net/buksu?retryWrites=true&w=majority&appName=BUKSU').then(() => {
  console.log('MongoDB connected successfully');
}).catch((err) => {
  console.error('MongoDB connection error:', err);
});

// Helper function to log activities
const logActivity = async (userId, action, description, details = null, req = null) => {
  try {
    let actualUserId = userId;

    // Handle special system admin actions
    if (userId === 'system_admin' || userId === 'default_admin') {
      // Create or find a system admin user for logging purposes
      let systemAdmin = await User.findOne({ email: 'system@admin.buksu.edu.ph' });
      if (!systemAdmin) {
        systemAdmin = new User({
          email: 'system@admin.buksu.edu.ph',
          name: 'System Admin',
          role: 'admin'
        });
        await systemAdmin.save();
      }
      actualUserId = systemAdmin._id;
    }

    const logData = {
      user: actualUserId,
      action,
      description,
      details,
      timestamp: new Date()
    };

    if (req) {
      logData.ipAddress = req.ip || req.connection.remoteAddress;
      logData.userAgent = req.get('User-Agent');
    }

    const activityLog = new ActivityLog(logData);
    await activityLog.save();
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// Google OAuth callback
app.post('/api/auth/google', async (req, res) => {
  try {
    const { email, name, picture } = req.body;

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, name, picture, role: 'student' });
      await user.save();
    }

    // Log login activity
    await logActivity(user._id, 'login', `User logged in via Google OAuth`, { 
      email: user.email, 
      name: user.name 
    }, req);

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Forgot password endpoint
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists or not for security
      return res.json({ message: 'If that email exists in our system, a password reset link has been sent.' });
    }

    // Only allow password reset for admin users
    if (user.role !== 'admin') {
      return res.json({ message: 'If that email exists in our system, a password reset link has been sent.' });
    }

    // Generate a simple reset token
    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    // Store reset token with expiration (24 hours)
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // Create email transporter (using nodemailer)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com',
        pass: process.env.EMAIL_PASS || 'your-app-password'
      }
    });

    // Email content
    const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@gmail.com',
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

    // Send email
    try {
      await transporter.sendMail(mailOptions);
      console.log('Password reset email sent to:', email);
      
      // Also return the reset URL in the response for testing/backup
      res.json({ 
        message: 'Password reset email has been sent to your email address.',
        resetUrl: resetUrl,
        resetToken: resetToken
      });
    } catch (emailError) {
      console.error('Error sending email:', emailError);
      console.log('========================================');
      console.log('PASSWORD RESET LINK (Email failed):');
      console.log('Email:', email);
      console.log('Reset URL:', resetUrl);
      console.log('Reset Token:', resetToken);
      console.log('========================================');
      
      // Fallback: return the reset URL and token in the response
      res.json({ 
        message: 'Email could not be sent, but here is your password reset link (also check server console):',
        resetUrl: resetUrl,
        resetToken: resetToken,
        email: email
      });
    }
  } catch (error) {
    console.error('Error sending reset email:', error);
    res.status(500).json({ message: 'Failed to send reset email' });
  }
});

// Admin login
app.post('/api/auth/admin', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    // Find user by email or username for admin login
    let user;
    if (email) {
      user = await User.findOne({ email, role: 'admin' });
    } else if (username) {
      user = await User.findOne({ username, role: 'admin' });
    }
    
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Log admin login activity
    await logActivity(user._id, 'admin_login', `Admin logged in manually`, { 
      email: user.email 
    }, req);

    res.json({ user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all users (admin only)
app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add admin user (admin only)
app.post('/api/admin/add-admin', async (req, res) => {
  try {
    const { email, password, name, username } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const admin = new User({ email, password, name, username, role: 'admin' });
    await admin.save();

    // Log admin creation
    await logActivity('system_admin', 'admin_create', `Admin account created for ${email}`, {
      adminEmail: email,
      adminName: name,
      adminUsername: username
    }, req);

    res.status(201).json({ message: 'Admin created successfully', admin });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(id);

    // Log user deletion
    await logActivity('system_admin', 'user_delete', `User deleted: ${user.email}`, { 
      deletedUserEmail: user.email, 
      deletedUserName: user.name 
    }, req);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all handbooks (admin only)
app.get('/api/admin/handbook', async (req, res) => {
  try {
    const handbooks = await Handbook.find().populate('createdBy').populate('priorityEditor').populate('editedBy').sort({ createdAt: -1 });
    res.json(handbooks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/reject handbook (admin only)
app.put('/api/admin/handbook/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const handbook = await Handbook.findById(id);
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    handbook.status = status;
    await handbook.save();

    // Log admin action
    await logActivity('system_admin', 'handbook_approve', `Handbook "${handbook.title}" ${status}`, { 
      handbookId: id, 
      title: handbook.title, 
      status 
    }, req);

    res.json({ message: `Handbook ${status} successfully`, handbook });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete handbook (admin only)
app.delete('/api/admin/handbook/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const handbook = await Handbook.findById(id);
    
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    await Handbook.findByIdAndDelete(id);

    // Log admin deletion
    await logActivity('system_admin', 'handbook_delete', `Handbook deleted: "${handbook.title}"`, { 
      handbookId: id, 
      title: handbook.title 
    }, req);

    res.json({ message: 'Handbook deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all memorandums (admin only)
app.get('/api/admin/memorandums', async (req, res) => {
  try {
    const memorandums = await Memorandum.find().populate('createdBy').populate('priorityEditor').populate('editedBy').sort({ uploadedAt: -1 });
    res.json(memorandums);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve/reject memorandum (admin only)
app.put('/api/admin/memorandums/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    memorandum.status = status;
    await memorandum.save();

    // Log admin action
    await logActivity('system_admin', 'memorandum_approve', `Memorandum "${memorandum.title}" ${status}`, { 
      memorandumId: id, 
      title: memorandum.title, 
      status 
    }, req);

    res.json({ message: `Memorandum ${status} successfully`, memorandum });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete memorandum (admin only)
app.delete('/api/admin/memorandums/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const memorandum = await Memorandum.findById(id);
    
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    await Memorandum.findByIdAndDelete(id);

    // Log admin deletion
    await logActivity('system_admin', 'memorandum_delete', `Memorandum deleted: "${memorandum.title}"`, { 
      memorandumId: id, 
      title: memorandum.title 
    }, req);

    res.json({ message: 'Memorandum deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload memorandum (president only)
app.post('/api/memorandums', async (req, res) => {
  try {
    const { title, year, fileUrl, userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can upload memorandum drafts' });
    }

    const memorandum = new Memorandum({ title, year, fileUrl, createdBy: userId });
    await memorandum.save();

    // Log president action
    await logActivity(userId, 'memorandum_upload', `Memorandum "${title}" uploaded`, { 
      memorandumId: memorandum._id, 
      title, 
      year 
    }, req);

    res.status(201).json({ message: 'Memorandum draft uploaded', memorandum });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Set priority editor for memorandum (president only)
app.post('/api/memorandums/:id/priority', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can set edit priority' });
    }

    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    // Any president can edit any memorandum

    // Set priority editor if not already set
    if (!memorandum.priorityEditor) {
      memorandum.priorityEditor = userId;
      memorandum.priorityEditStartedAt = new Date();
      await memorandum.save();
      
      res.status(200).json({ 
        message: 'You have edit priority', 
        memorandum,
        hasPriority: true
      });
    } else {
      // Someone else already has priority
      const priorityUser = await User.findById(memorandum.priorityEditor);
      res.status(200).json({ 
        message: 'Another user has edit priority', 
        memorandum,
        hasPriority: false,
        priorityEditor: priorityUser ? priorityUser.name : 'Unknown',
        priorityEditStartedAt: memorandum.priorityEditStartedAt
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update memorandum (president only) - only priority editor can save
app.put('/api/memorandums/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, year, fileUrl, userId, version } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can update memorandum drafts' });
    }

    // Find the memorandum - any president can edit any memorandum
    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    // Any president can edit any memorandum

    // Check if user has edit priority
    if (!memorandum.priorityEditor || memorandum.priorityEditor.toString() !== userId) {
      return res.status(409).json({ 
        message: 'You do not have edit priority. Only the first user to click edit can save changes.',
        hasPriority: false
      });
    }

    // Check version for concurrency control
    if (memorandum.version !== version) {
      return res.status(409).json({ message: 'Document has been modified. Please refresh and try again.' });
    }

    // Update memorandum and reset status to 'draft' for admin approval
    memorandum.title = title;
    memorandum.year = year;
    memorandum.fileUrl = fileUrl;
    memorandum.status = 'draft';
    memorandum.version = memorandum.version + 1;
    memorandum.editedBy = userId; // Track who edited
    memorandum.editedAt = new Date(); // Track when edited
    memorandum.priorityEditor = null; // Clear priority after successful save
    memorandum.priorityEditStartedAt = null;
    await memorandum.save();

    // Log president action
    await logActivity(userId, 'memorandum_update', `Memorandum "${memorandum.title}" updated`, { 
      memorandumId: id, 
      title: memorandum.title, 
      year: memorandum.year 
    }, req);

    res.status(200).json({ message: 'Memorandum updated successfully', memorandum });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create handbook page (president only)
app.post('/api/handbook', async (req, res) => {
  try {
    const { title, content, userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can create handbook drafts' });
    }

    const handbook = new Handbook({ title, content, createdBy: userId });
    await handbook.save();

    // Log president action
    await logActivity(userId, 'handbook_create', `Handbook page "${title}" created`, { 
      handbookId: handbook._id, 
      title 
    }, req);

    res.status(201).json({ message: 'Handbook draft created', handbook });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Set priority editor for handbook (president only)
app.post('/api/handbook/:id/priority', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can set edit priority' });
    }

    const handbook = await Handbook.findById(id);
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    // Any president can edit any handbook

    // Set priority editor if not already set
    if (!handbook.priorityEditor) {
      handbook.priorityEditor = userId;
      handbook.priorityEditStartedAt = new Date();
      await handbook.save();
      
      res.status(200).json({ 
        message: 'You have edit priority', 
        handbook,
        hasPriority: true
      });
    } else {
      // Someone else already has priority
      const priorityUser = await User.findById(handbook.priorityEditor);
      res.status(200).json({ 
        message: 'Another user has edit priority', 
        handbook,
        hasPriority: false,
        priorityEditor: priorityUser ? priorityUser.name : 'Unknown',
        priorityEditStartedAt: handbook.priorityEditStartedAt
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update handbook page (president only) - only priority editor can save
app.put('/api/handbook/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, userId, version } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can update handbook drafts' });
    }

    // Find the handbook - any president can edit any handbook
    const handbook = await Handbook.findById(id);
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    // Any president can edit any handbook

    // Check if user has edit priority
    if (!handbook.priorityEditor || handbook.priorityEditor.toString() !== userId) {
      return res.status(409).json({ 
        message: 'You do not have edit priority. Only the first user to click edit can save changes.',
        hasPriority: false
      });
    }

    // Check version for concurrency control
    if (handbook.version !== version) {
      return res.status(409).json({ message: 'Document has been modified. Please refresh and try again.' });
    }

    // Update handbook and reset status to 'draft' for admin approval
    handbook.title = title;
    handbook.content = content;
    handbook.status = 'draft';
    handbook.updatedAt = Date.now();
    handbook.version = handbook.version + 1;
    handbook.editedBy = userId; // Track who edited
    handbook.editedAt = new Date(); // Track when edited
    handbook.priorityEditor = null; // Clear priority after successful save
    handbook.priorityEditStartedAt = null;
    await handbook.save();

    // Log president action
    await logActivity(userId, 'handbook_update', `Handbook page "${handbook.title}" updated`, { 
      handbookId: id, 
      title: handbook.title 
    }, req);

    res.status(200).json({ message: 'Handbook updated successfully', handbook });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all handbook pages (public, approved only)
app.get('/api/handbook', async (req, res) => {
  try {
    const handbook = await Handbook.find({ status: 'approved' }).sort({ createdAt: -1 });
    res.json(handbook);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all memorandums (public, approved only)
app.get('/api/memorandums', async (req, res) => {
  try {
    const memorandums = await Memorandum.find({ status: 'approved' }).sort({ uploadedAt: -1 });
    res.json(memorandums);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get activity logs (admin only)
app.get('/api/admin/activity-logs', async (req, res) => {
  try {
    const logs = await ActivityLog.find()
      .populate('user', 'name email role')
      .sort({ timestamp: -1 })
      .limit(1000);
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user-specific activity logs (president only)
app.get('/api/president/activity-logs', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const logs = await ActivityLog.find({ user: userId })
      .populate('user', 'name email role')
      .sort({ timestamp: -1 })
      .limit(500);
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear priority editor for handbook (president only)
app.post('/api/handbook/:id/clear-priority', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can clear edit priority' });
    }

    const handbook = await Handbook.findById(id);
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    // Clear priority if this user has it
    if (handbook.priorityEditor && handbook.priorityEditor.toString() === userId) {
      handbook.priorityEditor = null;
      handbook.priorityEditStartedAt = null;
      await handbook.save();
    }

    res.status(200).json({ message: 'Priority cleared' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Clear priority editor for memorandum (president only)
app.post('/api/memorandums/:id/clear-priority', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user || user.role !== 'president') {
      return res.status(403).json({ message: 'Only presidents can clear edit priority' });
    }

    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    // Clear priority if this user has it
    if (memorandum.priorityEditor && memorandum.priorityEditor.toString() === userId) {
      memorandum.priorityEditor = null;
      memorandum.priorityEditStartedAt = null;
      await memorandum.save();
    }

    res.status(200).json({ message: 'Priority cleared' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cleanup expired priorities (run every 10 minutes)
setInterval(async () => {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    
    // Clear expired handbook priorities
    await Handbook.updateMany(
      { 
        priorityEditor: { $exists: true, $ne: null },
        priorityEditStartedAt: { $lt: tenMinutesAgo } 
      },
      { 
        $set: { 
          priorityEditor: null, 
          priorityEditStartedAt: null 
        } 
      }
    );
    
    // Clear expired memorandum priorities
    await Memorandum.updateMany(
      { 
        priorityEditor: { $exists: true, $ne: null },
        priorityEditStartedAt: { $lt: tenMinutesAgo } 
      },
      { 
        $set: { 
          priorityEditor: null, 
          priorityEditStartedAt: null 
        } 
      }
    );
  } catch (error) {
    console.error('Error cleaning up expired priorities:', error);
  }
}, 10 * 60 * 1000); // Run every 10 minutes

// Add reset password endpoint to actually change password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: 'Token and new password are required' });
    }

    // Find user by reset token
    const user = await User.findOne({ 
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

app.listen(PORT, () => {
    console.log("Server started on port", PORT);
    console.log(`Server is running at http://localhost:${PORT}`);
});