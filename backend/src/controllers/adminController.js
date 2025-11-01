import User from '../models/User.js';
import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import ActivityLog from '../models/ActivityLog.js';
import { logActivity } from '../utils/activityLogger.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

// Get all users
export const getUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

// Add admin user
export const addAdmin = async (req, res, next) => {
  try {
    const { email, password, name, username } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const admin = new User({ email, password, name, username, role: 'admin' });
    await admin.save();

    await logActivity('system_admin', 'admin_create', `Admin account created for ${email}`, {
      adminEmail: email,
      adminName: name,
      adminUsername: username
    }, req);

    // Send email notification
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.email.user || 'your-email@gmail.com',
          pass: config.email.pass || 'your-app-password'
        }
      });

      const mailOptions = {
        from: config.email.user || 'your-email@gmail.com',
        to: email,
        subject: 'Admin Account Created - BUKSU - SSC',
        html: `
          <h2>Welcome as Admin!</h2>
          <p>Dear ${name || 'Admin'},</p>
          <p>You have been added as an Administrator for the BUKSU Supreme Student Council system.</p>
          <p><strong>Your login credentials:</strong></p>
          <ul>
            <li>Username: ${username}</li>
            <li>Password: ${password}</li>
            <li>Email: ${email}</li>
          </ul>
          <p>You can now access the Admin Dashboard and manage the system.</p>
          <p>Thank you!</p>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log('Admin notification email sent to:', email);
    } catch (emailError) {
      console.error('Error sending admin notification email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({ message: 'Admin created successfully', admin });
  } catch (error) {
    next(error);
  }
};

// Add president user
export const addPresident = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });
    
    if (user) {
      // If user exists, update role to president
      if (user.role === 'president') {
        return res.status(400).json({ message: 'User is already a president' });
      }
      user.role = 'president';
      await user.save();
    } else {
      // Create new user with president role
      user = new User({ email, role: 'president' });
      await user.save();
    }

    await logActivity('system_admin', 'president_create', `President account created for ${email}`, {
      presidentEmail: email,
      presidentName: user.name || 'Unknown'
    }, req);

    // Send email notification
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.email.user || 'your-email@gmail.com',
          pass: config.email.pass || 'your-app-password'
        }
      });

      const mailOptions = {
        from: config.email.user || 'your-email@gmail.com',
        to: email,
        subject: 'President Account Created - BUKSU - SSC',
        html: `
          <h2>Welcome as President!</h2>
          <p>Dear ${user.name || 'President'},</p>
          <p>You have been added as a President for the BUKSU Supreme Student Council system.</p>
          <p>You can now log in using your Google account (${email}) and access the President Dashboard.</p>
          <p>Thank you!</p>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log('President notification email sent to:', email);
    } catch (emailError) {
      console.error('Error sending president notification email:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({ message: 'President added successfully', user });
  } catch (error) {
    next(error);
  }
};

// Delete user
export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(id);

    await logActivity('system_admin', 'user_delete', `User deleted: ${user.email}`, { 
      deletedUserEmail: user.email, 
      deletedUserName: user.name 
    }, req);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get all handbooks
export const getHandbooks = async (req, res, next) => {
  try {
    const handbooks = await Handbook.find()
      .populate('createdBy')
      .populate('priorityEditor')
      .populate('editedBy')
      .sort({ createdAt: -1 });
    res.json(handbooks);
  } catch (error) {
    next(error);
  }
};

// Approve/reject handbook
export const updateHandbookStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const handbook = await Handbook.findById(id);
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    handbook.status = status;
    await handbook.save();

    await logActivity('system_admin', 'handbook_approve', `Handbook "${handbook.title}" ${status}`, { 
      handbookId: id, 
      title: handbook.title, 
      status 
    }, req);

    res.json({ message: `Handbook ${status} successfully`, handbook });
  } catch (error) {
    next(error);
  }
};

// Delete handbook
export const deleteHandbook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const handbook = await Handbook.findById(id);
    
    if (!handbook) {
      return res.status(404).json({ message: 'Handbook not found' });
    }

    await Handbook.findByIdAndDelete(id);

    await logActivity('system_admin', 'handbook_delete', `Handbook deleted: "${handbook.title}"`, { 
      handbookId: id, 
      title: handbook.title 
    }, req);

    res.json({ message: 'Handbook deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get all memorandums
export const getMemorandums = async (req, res, next) => {
  try {
    const memorandums = await Memorandum.find()
      .populate('createdBy')
      .populate('priorityEditor')
      .populate('editedBy')
      .sort({ uploadedAt: -1 });
    res.json(memorandums);
  } catch (error) {
    next(error);
  }
};

// Approve/reject memorandum
export const updateMemorandumStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const memorandum = await Memorandum.findById(id);
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    memorandum.status = status;
    await memorandum.save();

    await logActivity('system_admin', 'memorandum_approve', `Memorandum "${memorandum.title}" ${status}`, { 
      memorandumId: id, 
      title: memorandum.title, 
      status 
    }, req);

    res.json({ message: `Memorandum ${status} successfully`, memorandum });
  } catch (error) {
    next(error);
  }
};

// Delete memorandum
export const deleteMemorandum = async (req, res, next) => {
  try {
    const { id } = req.params;
    const memorandum = await Memorandum.findById(id);
    
    if (!memorandum) {
      return res.status(404).json({ message: 'Memorandum not found' });
    }

    await Memorandum.findByIdAndDelete(id);

    await logActivity('system_admin', 'memorandum_delete', `Memorandum deleted: "${memorandum.title}"`, { 
      memorandumId: id, 
      title: memorandum.title 
    }, req);

    res.json({ message: 'Memorandum deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// Get activity logs
export const getActivityLogs = async (req, res, next) => {
  try {
    const logs = await ActivityLog.find()
      .populate('user', 'name email role')
      .sort({ timestamp: -1 })
      .limit(1000);
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

