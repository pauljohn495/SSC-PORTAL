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

    // Check for existing user with same email or username
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      // If user already exists as admin/president, update their details instead of blocking
      // This allows reusing email addresses after deletion
      if (existingUser.role === 'admin' || existingUser.role === 'president') {
        // Update existing admin/president account with new details
        existingUser.password = password;
        existingUser.name = name;
        existingUser.username = username;
        // Keep the role as is (admin stays admin, president stays president)
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
            subject: '[BUKSU SSC] Admin Account Updated',
            html: `
              <h2>Admin Account Updated</h2>
              <p>Dear ${name || 'Admin'},</p>
              <p>Your admin account has been updated with new credentials.</p>
              <p><strong>Account Details:</strong></p>
              <ul>
                <li><strong>Email:</strong> ${email}</li>
                <li><strong>Username:</strong> ${username}</li>
                <li><strong>Password:</strong> ${password}</li>
                <li><strong>Role:</strong> ${existingUser.role === 'admin' ? 'Admin' : 'President'}</li>
              </ul>
              <p>You can now log in to the portal using your credentials:</p>
              <hr>
              <p style="color: #666; font-size: 12px;">This is an automated email from BUKSU Supreme Student Council Portal.</p>
            `
          });
        } catch (emailError) {
          console.error('Error sending admin account update email:', emailError);
        }

        await logActivity('system_admin', 'admin_update', `Admin account updated for ${email}`, {
          adminEmail: email,
          adminName: name,
          adminUsername: username
        }, req);

        return res.status(200).json({ message: 'Admin account updated successfully', admin: existingUser });
      }
      // If it's a student, we can update them to admin
      existingUser.role = 'admin';
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
          subject: '[BUKSU SSC] Admin Account Created',
          html: `
            <h2>Welcome to BUKSU SSC Portal!</h2>
            <p>Dear ${name || 'Admin'},</p>
            <p>Your admin account has been successfully created.</p>
            <p><strong>Account Details:</strong></p>
            <ul>
              <li><strong>Email:</strong> ${email}</li>
              <li><strong>Username:</strong> ${username}</li>
              <li><strong>Password:</strong> ${password}</li>
              <li><strong>Role:</strong> Admin</li>
            </ul>
            <p>You can now log in to the portal using your credentials:</p>
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated email from BUKSU Supreme Student Council Portal.</p>
          `
        });
      } catch (emailError) {
        console.error('Error sending admin account creation email:', emailError);
      }

      await logActivity('system_admin', 'admin_create', `Admin account created for ${email} (upgraded from student)`, {
        adminEmail: email,
        adminName: name,
        adminUsername: username
      }, req);

      return res.status(200).json({ message: 'User upgraded to admin successfully', admin: existingUser });
    }

    const admin = new User({ email, password, name, username, role: 'admin' });
    await admin.save();

    // Send email notification to the new admin
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
        subject: '[BUKSU SSC] Admin Account Created',
        html: `
          <h2>Welcome to BUKSU SSC Portal!</h2>
          <p>Dear ${name || 'Admin'},</p>
          <p>Your admin account has been successfully created.</p>
          <p><strong>Account Details:</strong></p>
          <ul>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Username:</strong> ${username}</li>
            <li><strong>Password:</strong> ${password}</li>
            <li><strong>Role:</strong> Admin</li>
          </ul>
          <p>You can now log in to the portal using your credentials:</p>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated email from BUKSU Supreme Student Council Portal.</p>
        `
      });
    } catch (emailError) {
      console.error('Error sending admin account creation email:', emailError);
      // Continue even if email fails
    }

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

        return res.status(200).json({ message: 'User role updated to president', user });
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

        return res.status(201).json({ 
          message: 'President email added. They can log in via Google Authentication', 
          user: president 
        });
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

        return res.status(200).json({ message: 'President account updated successfully', user: existingUser });
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

      return res.status(200).json({ message: 'User upgraded to president successfully', user: existingUser });
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

    res.status(201).json({ message: 'President created successfully', user: president });
  } catch (error) {
    console.error('Error adding president:', error);
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

    await logActivity('system_admin', 'handbook_approve', `Handbook page ${handbook.pageNumber} ${status}`, { 
      handbookId: id, 
      pageNumber: handbook.pageNumber, 
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

    await logActivity('system_admin', 'handbook_delete', `Handbook page ${handbook.pageNumber} deleted`, { 
      handbookId: id, 
      pageNumber: handbook.pageNumber 
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

