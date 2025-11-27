import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Handbook from '../models/Handbook.js';
import Memorandum from '../models/Memorandum.js';
import ActivityLog from '../models/ActivityLog.js';
import HandbookSection from '../models/HandbookSection.js';
import Notification from '../models/Notification.js';
import { logActivity } from '../utils/activityLogger.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { sendPushToAllUsers } from '../utils/push.js';
import { emitGlobal } from '../realtime/socket.js';
import { removeFromAlgolia, saveHandbookToAlgolia, saveMemorandumToAlgolia } from '../services/algoliaService.js';
import { deletePDFFile } from '../utils/fileStorage.js';
import { deleteFileFromDrive } from '../utils/googleDrive.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to send email notification to president
const notifyPresident = async (subject, content) => {
  try {
    const president = await User.findOne({ role: 'president', email: { $exists: true, $ne: null } });
    if (!president || !president.email) {
      console.warn('President not found or has no email address');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.email.user || 'your-email@gmail.com',
        pass: config.email.pass || 'your-app-password'
      }
    });

    await transporter.sendMail({
      from: config.email.user || 'your-email@gmail.com',
      to: president.email,
      subject: `[BUKSU SSC] ${subject}`,
      html: content
    });
  } catch (emailError) {
    console.error('Error sending email notification to president:', emailError);
    // Continue even if email fails
  }
};

// Helper function to create simplified log and set response header
const logAndSetHeader = (req, res, method, endpoint, status, responseData) => {
  // Determine message based on response data and endpoint
  let message = null;
  
  // If response has a message property, use it
  if (responseData?.message) {
    message = responseData.message;
  } else if (Array.isArray(responseData)) {
    // For array responses, create a meaningful message based on endpoint
    const count = responseData.length;
    if (endpoint.includes('/admin/users')) {
      message = `Successfully retrieved ${count} user${count !== 1 ? 's' : ''}`;
    } else if (endpoint.includes('/admin/handbook')) {
      message = `Successfully retrieved ${count} handbook${count !== 1 ? 's' : ''}`;
    } else if (endpoint.includes('/admin/memorandums')) {
      message = `Successfully retrieved ${count} memorandum${count !== 1 ? 's' : ''}`;
    } else if (endpoint.includes('/admin/activity-logs')) {
      message = `Successfully retrieved ${count} activity log${count !== 1 ? 's' : ''}`;
    } else {
      message = `Successfully retrieved ${count} item${count !== 1 ? 's' : ''}`;
    }
  } else if (responseData && typeof responseData === 'object') {
    // For object responses without message, create a generic success message
    if (status >= 200 && status < 300) {
      message = 'Request successful';
    }
  }
  
  // Create simplified log data (only method, endpoint, status, message - no content)
  const logData = {
    method,
    endpoint,
    status,
    message
  };
  
  try {
    // Safely stringify, handling circular references and other edge cases
    let headerValue;
    try {
      headerValue = JSON.stringify(logData);
    } catch (stringifyError) {
      // If stringify fails, create a simplified version
      headerValue = JSON.stringify({
        method: logData.method,
        endpoint: logData.endpoint,
        status: logData.status,
        message: logData.message || 'Response data could not be serialized'
      });
    }
    
    headerValue = headerValue.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
    
    // Replace tabs, newlines, and carriage returns with spaces
    headerValue = headerValue.replace(/[\r\n\t]/g, ' ');
    
    // Replace multiple spaces with single space
    headerValue = headerValue.replace(/\s+/g, ' ');
    
    // Trim the value
    headerValue = headerValue.trim();
    
    if (headerValue.length > 8000) {
      // If too large, simplify further (shouldn't happen without content, but just in case)
      const simplifiedLogData = {
        method: logData.method,
        endpoint: logData.endpoint,
        status: logData.status,
        message: logData.message || null
      };
      headerValue = JSON.stringify(simplifiedLogData)
        .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
        .replace(/[\r\n\t]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Only set header if value is valid and not empty
    if (headerValue && headerValue.length > 0) {
      res.setHeader('X-API-Log', headerValue);
    }
  } catch (error) {
    // If header setting fails, just skip it (don't break the response)
    // Silently fail - browser will handle missing header gracefully
  }
  
  return logData;
};

// Get all users
export const getUsers = async (req, res, next) => {
  try {
    // Only return non-archived users
    const users = await User.find({ archived: { $ne: true } }).sort({ createdAt: -1 });
    logAndSetHeader(req, res, 'GET', '/api/admin/users', 200, users);
    res.json(users);
  } catch (error) {
    next(error);
  }
};

// Add admin user (requires email and name - new admin will set username/password via email link)
export const addAdmin = async (req, res, next) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      const response = { message: 'Email is required' };
      logAndSetHeader(req, res, 'POST', '/api/admin/add-admin', 400, response);
      return res.status(400).json(response);
    }

    if (!name) {
      const response = { message: 'Full name is required' };
      logAndSetHeader(req, res, 'POST', '/api/admin/add-admin', 400, response);
      return res.status(400).json(response);
    }

    // Check for existing user with same email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user already exists and is not archived, return error
      if (!existingUser.archived) {
        const response = { message: 'User with this email already exists' };
        logAndSetHeader(req, res, 'POST', '/api/admin/add-admin', 400, response);
        return res.status(400).json(response);
      }
      // If archived, we can reuse the account
      existingUser.archived = false;
      existingUser.archivedAt = null;
    }

    // Generate setup token
    const setupToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const setupTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    let admin;
    if (existingUser) {
      // Update existing archived user
      existingUser.role = 'admin';
      existingUser.name = name;
      existingUser.setupToken = setupToken;
      existingUser.setupTokenExpiry = setupTokenExpiry;
      existingUser.password = null; // Clear password until setup
      existingUser.username = null; // Clear username until setup
      await existingUser.save();
      admin = existingUser;
    } else {
      // Create new admin account
      admin = new User({ 
        email,
        name,
        role: 'admin',
        setupToken,
        setupTokenExpiry
      });
      await admin.save();
    }

    // Send email notification with setup link
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.email.user || 'your-email@gmail.com',
          pass: config.email.pass || 'your-app-password'
        }
      });

      const setupUrl = `${config.corsOrigin}/setup-account?token=${setupToken}`;
      await transporter.sendMail({
        from: config.email.user || 'your-email@gmail.com',
        to: email,
        subject: '[BUKSU SSC] Admin Account Setup',
        html: `
          <h2>Welcome to BUKSU SSC Portal!</h2>
          <p>Dear Admin,</p>
          <p>You have been added as an administrator to the BUKSU Supreme Student Council Portal.</p>
          <p>To complete your account setup, please click the link below to create your username and password:</p>
          <p><a href="${setupUrl}" style="background-color: #2563eb; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0;">Complete Account Setup</a></p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="color: #666; word-break: break-all;">${setupUrl}</p>
          <p><strong>Note:</strong> This link will expire in 7 days.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated email from BUKSU Supreme Student Council Portal.</p>
        `
      });
    } catch (emailError) {
      console.error('Error sending admin account setup email:', emailError);
      // Continue even if email fails
    }

    await logActivity('system_admin', 'admin_create', `Admin account invitation sent to ${email}`, {
      adminEmail: email
    }, req);

    const response = { message: 'Admin invitation sent successfully. The new admin will receive an email to complete account setup.', admin };
    logAndSetHeader(req, res, 'POST', '/api/admin/add-admin', 201, response);
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
};

// Add president user (creates account with email, password, name, username)
export const addPresident = async (req, res, next) => {
  try {
    const { email, password, name, username } = req.body;

    // If only email is provided, update existing user or create with minimal info
    if (email && !password && !name && !username) {
      let user = await User.findOne({ email });
      
      if (user) {
        // Update existing user to president role
        user.role = 'president';
        await user.save();
        
        // Send email notification to the user
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: config.email.user || 'your-email@gmail.com',
              pass: config.email.pass || 'your-app-password'
            }
          });

          const loginUrl = `${config.corsOrigin}/login`;
          await transporter.sendMail({
            from: config.email.user || 'your-email@gmail.com',
            to: email,
            subject: '[BUKSU SSC] President Role Assigned',
            html: `
              <h2>President Role Assigned</h2>
              <p>Dear ${user.name || 'User'},</p>
              <p>Your account has been assigned the <strong>President</strong> role in the BUKSU SSC Portal.</p>
              <p>You now have access to president features and can:</p>
              <ul>
                <li>Create and manage handbook pages</li>
                <li>Upload and edit memorandums</li>
                <li>Create and publish notifications</li>
                <li>View your activity logs</li>
              </ul>
              <p>You can log in using this Email Via Google</p>
              <hr>
              <p style="color: #666; font-size: 12px;">This is an automated email from BUKSU Supreme Student Council Portal.</p>
            `
          });
        } catch (emailError) {
          console.error('Error sending president role assignment email:', emailError);
          // Continue even if email fails
        }
        
        await logActivity('system_admin', 'president_create', `Existing user ${email} set as president`, {
          presidentEmail: email
        }, req);

        const response = { message: 'User role updated to president', user };
        logAndSetHeader(req, res, 'POST', '/api/admin/add-president', 200, response);
        return res.status(200).json(response);
      } else {
        // Create new user with just email (they'll need to set password later or use Google OAuth)
        const president = new User({ email, role: 'president' });
        await president.save();
        
        // Send email notification to the new president
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: config.email.user || 'your-email@gmail.com',
              pass: config.email.pass || 'your-app-password'
            }
          });

          const loginUrl = `${config.corsOrigin}/login`;
          await transporter.sendMail({
            from: config.email.user || 'your-email@gmail.com',
            to: email,
            subject: '[BUKSU SSC] President Account Created',
            html: `
              <h2>Welcome to BUKSU SSC Portal!</h2>
              <p>Dear President,</p>
              <p>Your president account has been created with the email: <strong>${email}</strong></p>
              <p>You can now log in using This Email Via Google. As a president, you have access to:</p>
              <ul>
                <li>Create and manage handbook pages</li>
                <li>Upload and edit memorandums</li>
                <li>Create and publish notifications</li>
                <li>View your activity logs</li>
              </ul>
              <hr>
              <p style="color: #666; font-size: 12px;">This is an automated email from BUKSU Supreme Student Council Portal.</p>
            `
          });
        } catch (emailError) {
          console.error('Error sending president account creation email:', emailError);
          // Continue even if email fails
        }
        
        await logActivity('system_admin', 'president_create', `President email added: ${email}`, {
          presidentEmail: email
        }, req);

        const response = { 
          message: 'President email added. They can log in via Google Authentication', 
          user: president 
        };
        logAndSetHeader(req, res, 'POST', '/api/admin/add-president', 201, response);
        return res.status(201).json(response);
      }
    }

    // Full president account creation (like admin)
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      // If user already exists as admin/president, update their details instead of blocking
      // This allows reusing email addresses after deletion
      if (existingUser.role === 'admin' || existingUser.role === 'president') {
        // Update existing admin/president account with new details and set to president
        existingUser.role = 'president';
        existingUser.password = password;
        existingUser.name = name;
        existingUser.username = username;
        await existingUser.save();
        
        // Send email notification
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: config.email.user || 'your-email@gmail.com',
              pass: config.email.pass || 'your-app-password'
            }
          });

          const loginUrl = `${config.corsOrigin}/login`;
          await transporter.sendMail({
            from: config.email.user || 'your-email@gmail.com',
            to: email,
            subject: '[BUKSU SSC] President Account Updated',
            html: `
              <h2>President Account Updated</h2>
              <p>Dear ${name || 'President'},</p>
              <p>Your president account has been updated with new credentials.</p>
              <p><strong>Account Details:</strong></p>
              <ul>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Role:</strong> President</li>
              </ul>
              <p>As a president, you have access to:</p>
              <ul>
                <li>Create and manage handbook pages</li>
                <li>Upload and edit memorandums</li>
                <li>Create and publish notifications</li>
                <li>View your activity logs</li>
              </ul>
              <hr>
              <p style="color: #666; font-size: 12px;">This is an automated email from BUKSU Supreme Student Council Portal.</p>
            `
          });
        } catch (emailError) {
          console.error('Error sending president account update email:', emailError);
        }

        await logActivity('system_admin', 'president_update', `President account updated for ${email}`, {
          presidentEmail: email,
          presidentName: name,
          presidentUsername: username
        }, req);

        const response = { message: 'President account updated successfully', user: existingUser };
        logAndSetHeader(req, res, 'POST', '/api/admin/add-president', 200, response);
        return res.status(200).json(response);
      }
      // If it's a student, we can update them to president
      existingUser.role = 'president';
      existingUser.password = password;
      existingUser.name = name;
      existingUser.username = username;
      await existingUser.save();
      
      // Send email notification
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: config.email.user || 'your-email@gmail.com',
            pass: config.email.pass || 'your-app-password'
          }
        });

        const loginUrl = `${config.corsOrigin}/login`;
        await transporter.sendMail({
          from: config.email.user || 'your-email@gmail.com',
          to: email,
          subject: '[BUKSU SSC] President Account Created',
          html: `
            <h2>Welcome to BUKSU SSC Portal!</h2>
            <p>Dear ${name || 'President'},</p>
            <p>Your president account has been successfully created.</p>
            <p><strong>Account Details:</strong></p>
            <ul>
              <li><strong>Email:</strong> ${email}</li>
              <li><strong>Role:</strong> President</li>
            </ul>
            <p>As a president, you have access to:</p>
            <ul>
              <li>Create and manage handbook pages</li>
              <li>Upload and edit memorandums</li>
              <li>Create and publish notifications</li>
              <li>View your activity logs</li>
            </ul>
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated email from BUKSU Supreme Student Council Portal.</p>
          `
        });
      } catch (emailError) {
        console.error('Error sending president account creation email:', emailError);
      }

      await logActivity('system_admin', 'president_create', `President account created for ${email} (upgraded from student)`, {
        presidentEmail: email,
        presidentName: name,
        presidentUsername: username
      }, req);

      const response = { message: 'User upgraded to president successfully', user: existingUser };
      logAndSetHeader(req, res, 'POST', '/api/admin/add-president', 200, response);
      return res.status(200).json(response);
    }

    const president = new User({ email, password, name, username, role: 'president' });
    await president.save();

    // Send email notification to the new president
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.email.user || 'your-email@gmail.com',
          pass: config.email.pass || 'your-app-password'
        }
      });

      const loginUrl = `${config.corsOrigin}/login`;
      await transporter.sendMail({
        from: config.email.user || 'your-email@gmail.com',
        to: email,
        subject: '[BUKSU SSC] President Account Created',
        html: `
          <h2>Welcome to BUKSU SSC Portal!</h2>
          <p>Dear ${name || 'President'},</p>
          <p>Your president account has been successfully created.</p>
          <p><strong>Account Details:</strong></p>
          <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Role:</strong> President</li>
          </ul>
          <p>As a president, you have access to:</p>
          <ul>
            <li>Create and manage handbook pages</li>
            <li>Upload and edit memorandums</li>
            <li>Create and publish notifications</li>
            <li>View your activity logs</li>
          </ul>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated email from BUKSU Supreme Student Council Portal.</p>
        `
      });
    } catch (emailError) {
      console.error('Error sending president account creation email:', emailError);
      // Continue even if email fails
    }

    await logActivity('system_admin', 'president_create', `President account created for ${email}`, {
      presidentEmail: email,
      presidentName: name,
      presidentUsername: username
    }, req);

    const response = { message: 'President created successfully', user: president };
    logAndSetHeader(req, res, 'POST', '/api/admin/add-president', 201, response);
    res.status(201).json(response);
  } catch (error) {
    console.error('Error adding president:', error);
    next(error);
  }
};

// Archive user (instead of deleting)
export const archiveUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    
    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/users/${id}/archive`, 404, response);
      return res.status(404).json(response);
    }

    if (user.archived) {
      const response = { message: 'User is already archived' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/users/${id}/archive`, 400, response);
      return res.status(400).json(response);
    }

    user.archived = true;
    user.archivedAt = new Date();
    await user.save();

    await logActivity('system_admin', 'user_archive', `User archived: ${user.email}`, { 
      archivedUserEmail: user.email, 
      archivedUserName: user.name 
    }, req);

    const response = { message: 'User archived successfully' };
    logAndSetHeader(req, res, 'PUT', `/api/admin/users/${id}/archive`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const restoreUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/users/${id}/restore`, 404, response);
      return res.status(404).json(response);
    }

    if (!user.archived) {
      const response = { message: 'User is not archived' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/users/${id}/restore`, 400, response);
      return res.status(400).json(response);
    }

    user.archived = false;
    user.archivedAt = null;
    await user.save();

    await logActivity('system_admin', 'user_restore', `User restored: ${user.email}`, {
      restoredUserEmail: user.email,
      restoredUserName: user.name
    }, req);

    const response = { message: 'User restored successfully', user };
    logAndSetHeader(req, res, 'PUT', `/api/admin/users/${id}/restore`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);

    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/users/${id}`, 404, response);
      return res.status(404).json(response);
    }

    await User.findByIdAndDelete(id);

    await logActivity('system_admin', 'user_delete', `User deleted permanently: ${user.email}`, {
      deletedUserEmail: user.email,
      deletedUserName: user.name
    }, req);

    const response = { message: 'User deleted permanently' };
    logAndSetHeader(req, res, 'DELETE', `/api/admin/users/${id}`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Get all handbooks
export const getHandbooks = async (req, res, next) => {
  try {
    const handbooks = await Handbook.find({ archived: { $ne: true } })
      .populate('createdBy')
      .populate('priorityEditor')
      .populate('editedBy')
      .sort({ createdAt: -1 });
    logAndSetHeader(req, res, 'GET', '/api/admin/handbook', 200, handbooks);
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
      const response = { message: 'Handbook not found' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook/${id}`, 404, response);
      return res.status(404).json(response);
    }

    // If approving, reject any existing approved handbooks (all pages from previous handbook)
    if (status === 'approved') {
      // Find all existing approved pages and reject them
      const existingApproved = await Handbook.find({ 
        status: 'approved',
        _id: { $ne: id }
      });
      
      if (existingApproved.length > 0) {
        // Reject all existing approved pages
        await Handbook.updateMany(
          { status: 'approved', _id: { $ne: id } },
          { status: 'rejected' }
        );
        
        // Log rejection for each page
        for (const oldHandbook of existingApproved) {
          await logActivity('system_admin', 'handbook_reject', `Previous handbook page rejected: ${oldHandbook.fileName || oldHandbook._id}`, { 
            handbookId: oldHandbook._id,
            fileName: oldHandbook.fileName
          }, req);
        }
      }
      
      // Find all pages from the same handbook upload (same createdBy and created within 1 minute)
      // This ensures we approve all pages from the same PDF upload
      // Include pages with any status (draft, rejected) but not already approved
      const sameHandbookPages = await Handbook.find({
        createdBy: handbook.createdBy,
        createdAt: {
          $gte: new Date(handbook.createdAt.getTime() - 60000), // 1 minute before
          $lte: new Date(handbook.createdAt.getTime() + 60000)  // 1 minute after
        },
        status: { $ne: 'approved' } // Include draft and rejected pages
      });
      
      // Approve all pages from the same handbook (including the one being clicked)
      if (sameHandbookPages.length > 0) {
        await Handbook.updateMany(
          {
            createdBy: handbook.createdBy,
            createdAt: {
              $gte: new Date(handbook.createdAt.getTime() - 60000),
              $lte: new Date(handbook.createdAt.getTime() + 60000)
            },
            status: { $ne: 'approved' }
          },
          { status: 'approved' }
        );
        
        // Fetch all approved pages to update Algolia
        const updatedPages = await Handbook.find({
          createdBy: handbook.createdBy,
          createdAt: {
            $gte: new Date(handbook.createdAt.getTime() - 60000),
            $lte: new Date(handbook.createdAt.getTime() + 60000)
          },
          status: 'approved'
        });
        
        for (const page of updatedPages) {
          try {
            await saveHandbookToAlgolia(page);
          } catch (algoliaError) {
            console.error(`Algolia sync (handbook page ${page.pageNumber}) failed:`, algoliaError);
          }
        }
        
        await logActivity('system_admin', 'handbook_approve', `Handbook approved with ${updatedPages.length} pages: ${handbook.fileName || 'Handbook'}`, { 
          handbookCount: updatedPages.length,
          fileName: handbook.fileName,
          status: 'approved'
        }, req);
        
        // Send push notification once for the entire handbook
        try {
          await sendPushToAllUsers('New Handbook Published', `The student handbook "${handbook.fileName || 'Handbook'}" is now available.`);
        } catch (pushErr) {
          console.error('Push send error (handbook approve):', pushErr);
        }
        
        try {
          emitGlobal('handbook:approved', { id: handbook._id, fileName: handbook.fileName });
        } catch (e) {}
        
        const response = { 
          message: `Handbook approved successfully with ${updatedPages.length} pages`, 
          totalPages: updatedPages.length,
          handbook: updatedPages[0] // Return first page as representative
        };
        logAndSetHeader(req, res, 'PUT', `/api/admin/handbook/${id}`, 200, response);
        return res.json(response);
      }
    }

    // For reject status, just update this single page
    handbook.status = status;
    await handbook.save();

    // For reject status, update Algolia and log
    if (status === 'rejected') {
      try {
        await saveHandbookToAlgolia(handbook);
      } catch (algoliaError) {
        console.error('Algolia sync (handbook) failed:', algoliaError);
      }

      await logActivity('system_admin', 'handbook_reject', `Handbook rejected: ${handbook.fileName || handbook._id}`, { 
        handbookId: id, 
        fileName: handbook.fileName,
        status 
      }, req);

      // Notify president via email
      await notifyPresident(
        'Handbook Rejected',
        `
          <h2>Handbook Rejected</h2>
          <p>Dear President,</p>
          <p>The administrator has rejected the following handbook:</p>
          <ul>
            <li><strong>File Name:</strong> ${handbook.fileName || handbook._id}</li>
            <li><strong>Page Number:</strong> ${handbook.pageNumber || 'N/A'}</li>
            <li><strong>Status:</strong> Rejected</li>
            <li><strong>Rejected At:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated notification from BUKSU Supreme Student Council Portal.</p>
        `
      );
    }
    
    const response = { message: `Handbook ${status} successfully`, handbook };
    logAndSetHeader(req, res, 'PUT', `/api/admin/handbook/${id}`, 200, response);
    res.json(response);
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
      const response = { message: 'Handbook not found' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook/${id}`, 404, response);
      return res.status(404).json(response);
    }

    handbook.archived = true;
    handbook.archivedAt = new Date();
    await handbook.save();

    try {
      await removeFromAlgolia(id.toString());
    } catch (algoliaError) {
      console.error('Algolia delete (handbook) failed:', algoliaError);
    }

    await logActivity('system_admin', 'handbook_archive', `Handbook archived: ${handbook.fileName || handbook._id}`, { 
      handbookId: id, 
      fileName: handbook.fileName
    }, req);

    // Notify president via email
    await notifyPresident(
      'Handbook Deleted',
      `
        <h2>Handbook Deleted</h2>
        <p>Dear President,</p>
        <p>The administrator has deleted the following handbook:</p>
        <ul>
          <li><strong>File Name:</strong> ${handbook.fileName || handbook._id}</li>
          <li><strong>Page Number:</strong> ${handbook.pageNumber || 'N/A'}</li>
          <li><strong>Deleted At:</strong> ${new Date().toLocaleString()}</li>
        </ul>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated notification from BUKSU Supreme Student Council Portal.</p>
      `
    );

    const response = { message: 'Handbook archived successfully' };
    logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook/${id}`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const restoreHandbook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const handbook = await Handbook.findById(id);

    if (!handbook) {
      const response = { message: 'Handbook not found' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook/${id}/restore`, 404, response);
      return res.status(404).json(response);
    }

    if (!handbook.archived) {
      const response = { message: 'Handbook is not archived' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook/${id}/restore`, 400, response);
      return res.status(400).json(response);
    }

    handbook.archived = false;
    handbook.archivedAt = null;
    await handbook.save();

    try {
      await saveHandbookToAlgolia(handbook);
    } catch (algoliaError) {
      console.error('Algolia sync (handbook restore) failed:', algoliaError);
    }

    await logActivity('system_admin', 'handbook_restore', `Handbook restored: ${handbook.fileName || handbook._id}`, {
      handbookId: id,
      fileName: handbook.fileName
    }, req);

    const response = { message: 'Handbook restored successfully', handbook };
    logAndSetHeader(req, res, 'PUT', `/api/admin/handbook/${id}/restore`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const permanentlyDeleteHandbook = async (req, res, next) => {
  try {
    const { id } = req.params;
    const handbook = await Handbook.findById(id);

    if (!handbook) {
      const response = { message: 'Handbook not found' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook/${id}/permanent`, 404, response);
      return res.status(404).json(response);
    }

    if (handbook.fileUrl && !handbook.fileUrl.startsWith('data:')) {
      try {
        const { deletePDFFile } = await import('../utils/fileStorage.js');
        await deletePDFFile(handbook.fileUrl);
      } catch (fileError) {
        console.warn(`Could not delete PDF file ${handbook.fileUrl}:`, fileError.message);
      }
    }

    if (handbook.googleDriveFileId && handbook.createdBy) {
      try {
        const { deleteFileFromDrive } = await import('../utils/googleDrive.js');
        await deleteFileFromDrive(handbook.googleDriveFileId, handbook.createdBy.toString());
      } catch (error) {
        console.warn(`Could not delete Google Drive file ${handbook.googleDriveFileId}:`, error.message);
      }
    }

    await Handbook.findByIdAndDelete(id);

    try {
      await removeFromAlgolia(id.toString());
    } catch (algoliaError) {
      console.error('Algolia delete (handbook permanent) failed:', algoliaError);
    }

    await logActivity('system_admin', 'handbook_delete', `Handbook deleted permanently: ${handbook.fileName || handbook._id}`, {
      handbookId: id,
      fileName: handbook.fileName
    }, req);

    const response = { message: 'Handbook deleted permanently' };
    logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook/${id}/permanent`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

const sectionStatusOrder = {
  pending: 0,
  approved: 1,
  rejected: 2,
};

export const getHandbookSectionsAdmin = async (req, res, next) => {
  try {
    const sections = await HandbookSection.find({ archived: { $ne: true } })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ createdAt: -1 });

    sections.sort((a, b) => {
      const statusDiff = sectionStatusOrder[a.status] - sectionStatusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return b.createdAt - a.createdAt;
    });

    logAndSetHeader(req, res, 'GET', '/api/admin/handbook-sections', 200, sections);
    res.json(sections);
  } catch (error) {
    next(error);
  }
};

export const updateHandbookSectionStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, adminId } = req.body;

    if (!adminId) {
      const response = { message: 'Admin ID is required' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook-sections/${id}/status`, 400, response);
      return res.status(400).json(response);
    }

    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      const response = { message: 'Only admins can update section status' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook-sections/${id}/status`, 403, response);
      return res.status(403).json(response);
    }

    if (!['approved', 'rejected'].includes(status)) {
      const response = { message: 'Invalid status' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook-sections/${id}/status`, 400, response);
      return res.status(400).json(response);
    }

    const section = await HandbookSection.findById(id);
    if (!section) {
      const response = { message: 'Section not found' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook-sections/${id}/status`, 404, response);
      return res.status(404).json(response);
    }

    section.status = status;
    section.published = status === 'approved';
    section.approvedBy = adminId;
    section.approvedAt = new Date();
    await section.save();

    const activity = status === 'approved' ? 'handbook_section_approve' : 'handbook_section_reject';
    await logActivity(adminId, activity, `Section "${section.title}" ${status}`, {
      sectionId: section._id,
      status,
    }, req);

    const response = { message: `Section ${status}`, section };
    logAndSetHeader(req, res, 'PUT', `/api/admin/handbook-sections/${id}/status`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const deleteHandbookSectionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body || {};

    if (!adminId) {
      const response = { message: 'Admin ID is required' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook-sections/${id}`, 400, response);
      return res.status(400).json(response);
    }

    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      const response = { message: 'Only admins can archive sections' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook-sections/${id}`, 403, response);
      return res.status(403).json(response);
    }

    const section = await HandbookSection.findById(id);
    if (!section) {
      const response = { message: 'Section not found' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook-sections/${id}`, 404, response);
      return res.status(404).json(response);
    }

    section.archived = true;
    section.archivedAt = new Date();
    await section.save();

    await logActivity(adminId, 'handbook_section_archive', `Section "${section.title}" archived`, {
      sectionId: section._id,
    }, req);

    const response = { message: 'Section archived successfully' };
    logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook-sections/${id}`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const restoreHandbookSectionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body || {};

    if (!adminId) {
      const response = { message: 'Admin ID is required' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook-sections/${id}/restore`, 400, response);
      return res.status(400).json(response);
    }

    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      const response = { message: 'Only admins can restore sections' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook-sections/${id}/restore`, 403, response);
      return res.status(403).json(response);
    }

    const section = await HandbookSection.findById(id);
    if (!section) {
      const response = { message: 'Section not found' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook-sections/${id}/restore`, 404, response);
      return res.status(404).json(response);
    }

    if (!section.archived) {
      const response = { message: 'Section is not archived' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/handbook-sections/${id}/restore`, 400, response);
      return res.status(400).json(response);
    }

    section.archived = false;
    section.archivedAt = null;
    await section.save();

    await logActivity(adminId, 'handbook_section_restore', `Section "${section.title}" restored`, {
      sectionId: section._id,
    }, req);

    const response = { message: 'Section restored successfully', section };
    logAndSetHeader(req, res, 'PUT', `/api/admin/handbook-sections/${id}/restore`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const permanentlyDeleteHandbookSectionAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body || {};

    if (!adminId) {
      const response = { message: 'Admin ID is required' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook-sections/${id}/permanent`, 400, response);
      return res.status(400).json(response);
    }

    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      const response = { message: 'Only admins can delete sections' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook-sections/${id}/permanent`, 403, response);
      return res.status(403).json(response);
    }

    const section = await HandbookSection.findById(id);
    if (!section) {
      const response = { message: 'Section not found' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook-sections/${id}/permanent`, 404, response);
      return res.status(404).json(response);
    }

    if (section.googleDriveFileId) {
      await deleteFileFromDrive(section.googleDriveFileId, adminId);
    } else if (section.fileUrl && !section.fileUrl.startsWith('http')) {
      deletePDFFile(section.fileUrl);
    }

    await HandbookSection.findByIdAndDelete(id);

    await logActivity(adminId, 'handbook_section_delete_permanent', `Section "${section.title}" permanently deleted`, {
      sectionId: section._id,
    }, req);

    const response = { message: 'Section deleted permanently' };
    logAndSetHeader(req, res, 'DELETE', `/api/admin/handbook-sections/${id}/permanent`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const getArchivedHandbookSections = async (req, res, next) => {
  try {
    const sections = await HandbookSection.find({ archived: true })
      .populate('createdBy', 'name email')
      .sort({ archivedAt: -1 });
    logAndSetHeader(req, res, 'GET', '/api/admin/handbook-sections/archived', 200, sections);
    res.json(sections);
  } catch (error) {
    next(error);
  }
};

// Get all memorandums
export const getMemorandums = async (req, res, next) => {
  try {
    const memorandums = await Memorandum.find({ archived: { $ne: true } })
      .populate('createdBy')
      .populate('priorityEditor')
      .populate('editedBy')
      .sort({ uploadedAt: -1 });
    logAndSetHeader(req, res, 'GET', '/api/admin/memorandums', 200, memorandums);
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
      const response = { message: 'Memorandum not found' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/memorandums/${id}`, 404, response);
      return res.status(404).json(response);
    }

    memorandum.status = status;
    await memorandum.save();

    try {
      await saveMemorandumToAlgolia(memorandum);
    } catch (algoliaError) {
      console.error('Algolia sync (memorandum) failed:', algoliaError);
    }

    await logActivity('system_admin', 'memorandum_approve', `Memorandum "${memorandum.title}" ${status}`, { 
      memorandumId: id, 
      title: memorandum.title, 
      status 
    }, req);

    // If approved, send push to all users
    if (status === 'approved') {
      try {
        await sendPushToAllUsers('New Memorandum Published', `${memorandum.title} is now available.`);
      } catch (pushErr) {
        console.error('Push send error (memorandum approve):', pushErr);
      }
      try {
        emitGlobal('memorandum:approved', { id: memorandum._id, title: memorandum.title });
      } catch (e) {}
    }

    // If rejected, notify president via email
    if (status === 'rejected') {
      await notifyPresident(
        'Memorandum Rejected',
        `
          <h2>Memorandum Rejected</h2>
          <p>Dear President,</p>
          <p>The administrator has rejected the following memorandum:</p>
          <ul>
            <li><strong>Title:</strong> ${memorandum.title}</li>
            <li><strong>Status:</strong> Rejected</li>
            <li><strong>Rejected At:</strong> ${new Date().toLocaleString()}</li>
          </ul>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated notification from BUKSU Supreme Student Council Portal.</p>
        `
      );
    }

    const response = { message: `Memorandum ${status} successfully`, memorandum };
    logAndSetHeader(req, res, 'PUT', `/api/admin/memorandums/${id}`, 200, response);
    res.json(response);
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
      const response = { message: 'Memorandum not found' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/memorandums/${id}`, 404, response);
      return res.status(404).json(response);
    }

    memorandum.archived = true;
    memorandum.archivedAt = new Date();
    await memorandum.save();

    try {
      await removeFromAlgolia(id.toString());
    } catch (algoliaError) {
      console.error('Algolia delete (memorandum) failed:', algoliaError);
    }

    await logActivity('system_admin', 'memorandum_archive', `Memorandum archived: "${memorandum.title}"`, { 
      memorandumId: id, 
      title: memorandum.title 
    }, req);

    // Notify president via email
    await notifyPresident(
      'Memorandum Deleted',
      `
        <h2>Memorandum Deleted</h2>
        <p>Dear President,</p>
        <p>The administrator has deleted the following memorandum:</p>
        <ul>
          <li><strong>Title:</strong> ${memorandum.title}</li>
          <li><strong>Deleted At:</strong> ${new Date().toLocaleString()}</li>
        </ul>
        <hr>
        <p style="color: #666; font-size: 12px;">This is an automated notification from BUKSU Supreme Student Council Portal.</p>
      `
    );

    const response = { message: 'Memorandum archived successfully' };
    logAndSetHeader(req, res, 'DELETE', `/api/admin/memorandums/${id}`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const restoreMemorandum = async (req, res, next) => {
  try {
    const { id } = req.params;
    const memorandum = await Memorandum.findById(id);

    if (!memorandum) {
      const response = { message: 'Memorandum not found' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/memorandums/${id}/restore`, 404, response);
      return res.status(404).json(response);
    }

    if (!memorandum.archived) {
      const response = { message: 'Memorandum is not archived' };
      logAndSetHeader(req, res, 'PUT', `/api/admin/memorandums/${id}/restore`, 400, response);
      return res.status(400).json(response);
    }

    memorandum.archived = false;
    memorandum.archivedAt = null;
    await memorandum.save();

    try {
      await saveMemorandumToAlgolia(memorandum);
    } catch (algoliaError) {
      console.error('Algolia sync (memorandum restore) failed:', algoliaError);
    }

    await logActivity('system_admin', 'memorandum_restore', `Memorandum restored: "${memorandum.title}"`, {
      memorandumId: id,
      title: memorandum.title
    }, req);

    const response = { message: 'Memorandum restored successfully', memorandum };
    logAndSetHeader(req, res, 'PUT', `/api/admin/memorandums/${id}/restore`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const permanentlyDeleteMemorandum = async (req, res, next) => {
  try {
    const { id } = req.params;
    const memorandum = await Memorandum.findById(id);

    if (!memorandum) {
      const response = { message: 'Memorandum not found' };
      logAndSetHeader(req, res, 'DELETE', `/api/admin/memorandums/${id}/permanent`, 404, response);
      return res.status(404).json(response);
    }

    await Memorandum.findByIdAndDelete(id);

    try {
      await removeFromAlgolia(id.toString());
    } catch (algoliaError) {
      console.error('Algolia delete (memorandum permanent) failed:', algoliaError);
    }

    await logActivity('system_admin', 'memorandum_delete', `Memorandum deleted permanently: "${memorandum.title}"`, {
      memorandumId: id,
      title: memorandum.title
    }, req);

    const response = { message: 'Memorandum deleted permanently' };
    logAndSetHeader(req, res, 'DELETE', `/api/admin/memorandums/${id}/permanent`, 200, response);
    res.json(response);
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
    logAndSetHeader(req, res, 'GET', '/api/admin/activity-logs', 200, logs);
    res.json(logs);
  } catch (error) {
    next(error);
  }
};

export const getArchivedItems = async (req, res, next) => {
  try {
    const [handbooks, memorandums, users] = await Promise.all([
      Handbook.find({ archived: true }).populate('createdBy').sort({ archivedAt: -1 }),
      Memorandum.find({ archived: true }).populate('createdBy').sort({ archivedAt: -1 }),
      User.find({ archived: true }).sort({ archivedAt: -1 })
    ]);

    const response = { handbooks, memorandums, users };
    logAndSetHeader(req, res, 'GET', '/api/admin/archived', 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const createManualBackup = async (req, res, next) => {
  try {
    const { adminId } = req.body || {};

    if (!adminId) {
      const response = { message: 'Admin ID is required' };
      logAndSetHeader(req, res, 'POST', '/api/admin/backups', 400, response);
      return res.status(400).json(response);
    }

    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      const response = { message: 'Only admins can generate backups' };
      logAndSetHeader(req, res, 'POST', '/api/admin/backups', 403, response);
      return res.status(403).json(response);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `ipt-collab-backup-${timestamp}.zip`;
    logAndSetHeader(req, res, 'POST', '/api/admin/backups', 200, { message: 'Generating backup archive', archiveName });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${archiveName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', (err) => {
      console.error('Backup archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to generate backup archive' });
      } else {
        res.end();
      }
    });

    archive.pipe(res);

    const metadata = {
      generatedAt: new Date().toISOString(),
      generatedBy: {
        id: admin._id,
        name: admin.name,
        email: admin.email
      },
      includes: ['users', 'handbooks', 'handbookSections', 'memorandums', 'notifications', 'activityLogs']
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    const collections = [
      { filename: 'users.json', data: await User.find().lean() },
      { filename: 'handbooks.json', data: await Handbook.find().lean() },
      { filename: 'handbookSections.json', data: await HandbookSection.find().lean() },
      { filename: 'memorandums.json', data: await Memorandum.find().lean() },
      { filename: 'notifications.json', data: await Notification.find().lean() },
      { filename: 'activityLogs.json', data: await ActivityLog.find().lean() }
    ];

    collections.forEach(({ filename, data }) => {
      archive.append(JSON.stringify(data, null, 2), { name: `database/${filename}` });
    });

    await archive.finalize();

    await logActivity(
      adminId,
      'manual_backup',
      `Manual backup generated (${archiveName})`,
      { archiveName, collections: collections.length },
      req
    );
  } catch (error) {
    next(error);
  }
};

