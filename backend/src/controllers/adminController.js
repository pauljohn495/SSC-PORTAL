import User from '../models/User.js';
import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import ActivityLog from '../models/ActivityLog.js';
import { logActivity } from '../utils/activityLogger.js';

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

    res.status(201).json({ message: 'Admin created successfully', admin });
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

