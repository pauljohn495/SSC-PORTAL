import User from '../models/User.js';
import { logActivity } from '../utils/activityLogger.js';
import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import mongoose from 'mongoose';

// Helper function to create simplified log and set response header
const logAndSetHeader = (req, res, method, endpoint, status, responseData) => {
  // Determine message based on response data and endpoint
  let message = null;
  
  // If response has a message property, use it
  if (responseData?.message) {
    message = responseData.message;
  } else if (responseData?.user) {
    // For login responses with user object
    if (endpoint.includes('/auth/google')) {
      message = 'Google OAuth login successful';
    } else if (endpoint.includes('/auth/admin')) {
      message = 'Admin login successful';
    } else if (endpoint.includes('/auth/profile')) {
      message = 'Profile updated successfully';
    } else {
      message = 'Request successful';
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

const ensureProfileCompletedFlag = (user) => {
  if (user && user.department && user.course && !user.profileCompleted) {
    user.profileCompleted = true;
  }
};

const buildUserResponse = (user) => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  username: user.username,
  role: user.role,
  picture: user.picture,
  googleId: user.googleId,
  department: user.department || null,
  course: user.course || null,
  profileCompleted: typeof user.profileCompleted === 'boolean'
    ? user.profileCompleted
    : Boolean(user.department && user.course),
  googleDriveConnected: Boolean(user.googleDrive?.refreshToken || user.googleDrive?.accessToken)
});

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
          const response = { message: 'reCAPTCHA verification failed' };
          logAndSetHeader(req, res, 'POST', '/api/auth/google', 401, response);
          return res.status(401).json(response);
        }
      }
    }

    // Email domain validation
    const allowedStudentDomain = '@student.buksu.edu.ph';
    const isStudentEmail = email && email.toLowerCase().endsWith(allowedStudentDomain.toLowerCase());

    let user = await User.findOne({ email });
    
    if (!user) {
      // New user - check if email is valid
      // Presidents can have any email, but for new users we only allow @student.buksu.edu.ph
      // (Presidents should be created by admin first)
      if (!isStudentEmail) {
        const response = { 
          message: 'Only @student.buksu.edu.ph email addresses are allowed for student accounts. If you are a president, please contact the administrator to set up your account.' 
        };
        logAndSetHeader(req, res, 'POST', '/api/auth/google', 403, response);
        return res.status(403).json(response);
      }
      
      user = new User({ email, name, picture, googleId, role: 'student' });
      ensureProfileCompletedFlag(user);
      await user.save();
    } else {
      // Existing user - check role and email domain
      // Presidents are allowed regardless of email domain
      if (user.role === 'president') {
        // President can login with any email
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
        ensureProfileCompletedFlag(user);
        await user.save();
      } else if (user.role === 'admin') {
        // Admins use manual login, not Google OAuth
        const response = { 
          message: 'Admin accounts must use the admin login form, not Google login.' 
        };
        logAndSetHeader(req, res, 'POST', '/api/auth/google', 403, response);
        return res.status(403).json(response);
      } else {
        // Student or no role - must have @student.buksu.edu.ph email
        if (!isStudentEmail) {
          const response = { 
            message: 'Only @student.buksu.edu.ph email addresses are allowed for student accounts.' 
          };
          logAndSetHeader(req, res, 'POST', '/api/auth/google', 403, response);
          return res.status(403).json(response);
        }
        
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
        ensureProfileCompletedFlag(user);
        await user.save();
      }
    }

    await logActivity(user._id, 'login', `User logged in via Google OAuth`, { 
      email: user.email, 
      name: user.name 
    }, req);

    // Return user object with all necessary fields
    const response = { user: buildUserResponse(user) };
    logAndSetHeader(req, res, 'POST', '/api/auth/google', 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Admin login (only admins can manually login - presidents use Google OAuth)
export const adminLogin = async (req, res, next) => {
  try {
    // Check database connection first
    if (mongoose.connection.readyState !== 1) {
      const response = { message: 'Database connection unavailable. Please try again.' };
      logAndSetHeader(req, res, 'POST', '/api/auth/admin', 503, response);
      return res.status(503).json(response);
    }
    
    const { email, password, username, recaptchaToken } = req.body;

    // Verify reCAPTCHA token if provided
    if (recaptchaToken && recaptchaToken !== 'null' && recaptchaToken !== '') {
      const isValidRecaptcha = await verifyRecaptcha(recaptchaToken);
      if (!isValidRecaptcha) {
        // In development mode, allow login even if reCAPTCHA fails
        if (config.nodeEnv !== 'development') {
          const response = { message: 'reCAPTCHA verification failed' };
          logAndSetHeader(req, res, 'POST', '/api/auth/admin', 401, response);
          return res.status(401).json(response);
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
      const response = { message: 'Email or username is required' };
      logAndSetHeader(req, res, 'POST', '/api/auth/admin', 400, response);
      return res.status(400).json(response);
    }
    
    if (!user) {
      const response = { message: 'Invalid credentials' };
      logAndSetHeader(req, res, 'POST', '/api/auth/admin', 401, response);
      return res.status(401).json(response);
    }

    // Check if user has a password set
    if (!user.password) {
      const response = { message: 'Account does not have a password set. Please contact administrator.' };
      logAndSetHeader(req, res, 'POST', '/api/auth/admin', 401, response);
      return res.status(401).json(response);
    }

    // Check password
    if (user.password !== password) {
      const response = { message: 'Invalid credentials' };
      logAndSetHeader(req, res, 'POST', '/api/auth/admin', 401, response);
      return res.status(401).json(response);
    }

    await logActivity(user._id, 'admin_login', `Admin logged in manually`, { 
      email: user.email,
      username: user.username 
    }, req);

    // Return user object with all necessary fields
    const response = { user: buildUserResponse(user) };
    logAndSetHeader(req, res, 'POST', '/api/auth/admin', 200, response);
    res.json(response);
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
      const response = { message: 'Email is required' };
      logAndSetHeader(req, res, 'POST', '/api/auth/forgot-password', 400, response);
      return res.status(400).json(response);
    }

    // Check if email configuration is set
    if (!config.email.user || !config.email.pass || 
        config.email.user === 'your-email@gmail.com' || 
        config.email.pass === 'your-app-password') {
      console.error('Email configuration is not set. Please configure EMAIL_USER and EMAIL_PASS in .env file');
      const response = { 
        message: 'Email service is not configured. Please contact the administrator.',
        error: 'EMAIL_CONFIG_MISSING'
      };
      logAndSetHeader(req, res, 'POST', '/api/auth/forgot-password', 500, response);
      return res.status(500).json(response);
    }

    // Log email config (without password) for debugging
    console.log('Email configuration check:', {
      user: config.email.user,
      passSet: !!config.email.pass,
      passLength: config.email.pass ? config.email.pass.length : 0
    });

    const user = await User.findOne({ email });
    if (!user) {
      // Security: Don't reveal if email exists
      const response = { message: 'If that email exists in our system, a password reset link has been sent.' };
      logAndSetHeader(req, res, 'POST', '/api/auth/forgot-password', 200, response);
      return res.json(response);
    }

    if (user.role !== 'admin') {
      // Security: Don't reveal if email exists or role
      const response = { message: 'If that email exists in our system, a password reset link has been sent.' };
      logAndSetHeader(req, res, 'POST', '/api/auth/forgot-password', 200, response);
      return res.json(response);
    }

    const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    // Create transporter with proper error handling
    let transporter;
    try {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.email.user,
          pass: config.email.pass
        },
        debug: config.nodeEnv === 'development', // Enable debug in development
        logger: config.nodeEnv === 'development' // Enable logger in development
      });

      // Verify transporter configuration
      console.log('Verifying email transporter connection...');
      await transporter.verify();
      console.log('✓ Email transporter verified successfully');
    } catch (transporterError) {
      console.error('✗ Error creating/verifying email transporter:', {
        message: transporterError.message,
        code: transporterError.code,
        command: transporterError.command,
        response: transporterError.response,
        responseCode: transporterError.responseCode,
        stack: transporterError.stack
      });
      const response = { 
        message: 'Email service configuration error. Please contact the administrator.',
        error: 'EMAIL_TRANSPORTER_ERROR',
        details: config.nodeEnv === 'development' ? {
          message: transporterError.message,
          code: transporterError.code,
          response: transporterError.response
        } : undefined
      };
      logAndSetHeader(req, res, 'POST', '/api/auth/forgot-password', 500, response);
      return res.status(500).json(response);
    }

    const resetUrl = `${config.corsOrigin}/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: `"BUKSU SSC Portal" <${config.email.user}>`,
      to: email,
      subject: 'Password Reset Request - BUKSU - SSC',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Password Reset Request</h2>
          <p>You requested a password reset for your admin account.</p>
          <p>Click the link below to reset your password:</p>
          <p style="margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="color: #666; font-size: 12px; word-break: break-all;">Or copy and paste this link: ${resetUrl}</p>
          <p style="color: #666; font-size: 12px;">This link will expire in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 11px;">If you didn't request this, please ignore this email.</p>
        </div>
      `
    };

    try {
      console.log('Attempting to send password reset email to:', email);
      console.log('Reset URL:', resetUrl);
      const info = await transporter.sendMail(mailOptions);
      console.log('✓ Password reset email sent successfully:', {
        to: email,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        pending: info.pending,
        responseCode: info.responseCode
      });
      
      // Also log the reset token for debugging (only in development)
      if (config.nodeEnv === 'development') {
        console.log('Reset token (for testing):', resetToken);
      }
      
      const response = { 
        message: 'Password reset email has been sent to your email address. Please check your inbox and spam folder.',
        success: true
      };
      logAndSetHeader(req, res, 'POST', '/api/auth/forgot-password', 200, response);
      res.json(response);
    } catch (emailError) {
      console.error('✗ Error sending password reset email:', {
        error: emailError.message,
        code: emailError.code,
        command: emailError.command,
        response: emailError.response,
        responseCode: emailError.responseCode,
        to: email,
        stack: emailError.stack
      });
      
      // Provide helpful error messages based on error type
      let errorMessage = 'Failed to send password reset email. Please try again later.';
      if (emailError.code === 'EAUTH') {
        errorMessage = 'Email authentication failed. Please verify your email credentials in the .env file. Make sure you\'re using an App Password, not your regular Gmail password.';
      } else if (emailError.code === 'ECONNECTION' || emailError.code === 'ETIMEDOUT') {
        errorMessage = 'Email service connection error. Please check your internet connection and try again later.';
      } else if (emailError.responseCode === 535) {
        errorMessage = 'Authentication failed. Please check your email credentials. Make sure you\'re using a Gmail App Password.';
      } else if (emailError.responseCode === 550) {
        errorMessage = 'Email address not found or access denied.';
      }

      const response = { 
        message: errorMessage,
        error: 'EMAIL_SEND_ERROR',
        details: config.nodeEnv === 'development' ? {
          message: emailError.message,
          code: emailError.code,
          response: emailError.response,
          responseCode: emailError.responseCode
        } : undefined
      };
      logAndSetHeader(req, res, 'POST', '/api/auth/forgot-password', 500, response);
      return res.status(500).json(response);
    }
  } catch (error) {
    console.error('Unexpected error in forgotPassword:', error);
    next(error);
  }
};

// Test email configuration (development only)
export const testEmail = async (req, res, next) => {
  try {
    // Only allow in development
    if (config.nodeEnv !== 'development') {
      return res.status(403).json({ message: 'This endpoint is only available in development mode' });
    }

    const { testEmail: email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Test email address is required' });
    }

    // Check if email configuration is set
    if (!config.email.user || !config.email.pass) {
      return res.status(500).json({ 
        message: 'Email configuration is not set',
        error: 'EMAIL_CONFIG_MISSING'
      });
    }

    console.log('Testing email configuration...');
    console.log('Email user:', config.email.user);
    console.log('Password set:', !!config.email.pass);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.email.user,
        pass: config.email.pass
      },
      debug: true,
      logger: true
    });

    // Verify connection
    console.log('Verifying transporter...');
    await transporter.verify();
    console.log('✓ Transporter verified');

    // Send test email
    const mailOptions = {
      from: `"BUKSU SSC Portal Test" <${config.email.user}>`,
      to: email,
      subject: 'Test Email - BUKSU SSC Portal',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1e40af;">Test Email</h2>
          <p>This is a test email from the BUKSU SSC Portal.</p>
          <p>If you received this email, your email configuration is working correctly!</p>
          <p style="color: #666; font-size: 12px;">Sent at: ${new Date().toLocaleString()}</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✓ Test email sent:', {
      messageId: info.messageId,
      response: info.response,
      accepted: info.accepted,
      rejected: info.rejected
    });

    res.json({ 
      message: 'Test email sent successfully!',
      details: {
        to: email,
        messageId: info.messageId,
        response: info.response
      }
    });
  } catch (error) {
    console.error('✗ Test email error:', {
      message: error.message,
      code: error.code,
      response: error.response,
      responseCode: error.responseCode
    });
    res.status(500).json({ 
      message: 'Failed to send test email',
      error: error.message,
      code: error.code,
      response: error.response
    });
  }
};

// Reset password
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      const response = { message: 'Token and new password are required' };
      logAndSetHeader(req, res, 'POST', '/api/auth/reset-password', 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findOne({ 
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      const response = { message: 'Invalid or expired reset token' };
      logAndSetHeader(req, res, 'POST', '/api/auth/reset-password', 400, response);
      return res.status(400).json(response);
    }

    user.password = newPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    const response = { message: 'Password has been reset successfully' };
    logAndSetHeader(req, res, 'POST', '/api/auth/reset-password', 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Setup admin account (create username and password)
export const setupAccount = async (req, res, next) => {
  try {
    const { token, username, password, name } = req.body;

    if (!token || !username || !password) {
      const response = { message: 'Token, username, and password are required' };
      logAndSetHeader(req, res, 'POST', '/api/auth/setup-account', 400, response);
      return res.status(400).json(response);
    }

    if (password.length < 6) {
      const response = { message: 'Password must be at least 6 characters long' };
      logAndSetHeader(req, res, 'POST', '/api/auth/setup-account', 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findOne({ 
      setupToken: token,
      setupTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      const response = { message: 'Invalid or expired setup token' };
      logAndSetHeader(req, res, 'POST', '/api/auth/setup-account', 400, response);
      return res.status(400).json(response);
    }

    // Check if username is already taken
    const existingUsername = await User.findOne({ 
      username,
      _id: { $ne: user._id }
    });

    if (existingUsername) {
      const response = { message: 'Username is already taken' };
      logAndSetHeader(req, res, 'POST', '/api/auth/setup-account', 400, response);
      return res.status(400).json(response);
    }

    // Update user with username, password, and name
    user.username = username;
    user.password = password;
    if (name) {
      user.name = name;
    }
    user.setupToken = null;
    user.setupTokenExpiry = null;
    await user.save();

    const response = { message: 'Account setup completed successfully. You can now log in.' };
    logAndSetHeader(req, res, 'POST', '/api/auth/setup-account', 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

// Register/update FCM token for a user
export const registerFcmToken = async (req, res, next) => {
  try {
    const { userId, fcmToken } = req.body;
    if (!userId || !fcmToken) {
      const response = { message: 'userId and fcmToken are required' };
      logAndSetHeader(req, res, 'POST', '/api/auth/fcm-token', 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findById(userId);
    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'POST', '/api/auth/fcm-token', 404, response);
      return res.status(404).json(response);
    }

    if (!user.fcmTokens) user.fcmTokens = [];
    if (!user.fcmTokens.includes(fcmToken)) {
      user.fcmTokens.push(fcmToken);
      await user.save();
    }

    const response = { message: 'FCM token registered' };
    logAndSetHeader(req, res, 'POST', '/api/auth/fcm-token', 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { department, course } = req.body;

    if (!department || !course) {
      const response = { message: 'Department and course are required' };
      logAndSetHeader(req, res, 'PUT', `/api/auth/profile/${id}`, 400, response);
      return res.status(400).json(response);
    }

    const user = await User.findById(id);
    if (!user) {
      const response = { message: 'User not found' };
      logAndSetHeader(req, res, 'PUT', `/api/auth/profile/${id}`, 404, response);
      return res.status(404).json(response);
    }

    user.department = department;
    user.course = course;
    user.profileCompleted = true;

    await user.save();

    await logActivity(
      user._id,
      'profile_update',
      'User updated profile information',
      { department, course },
      req
    );

    const response = { user: buildUserResponse(user) };
    logAndSetHeader(req, res, 'PUT', `/api/auth/profile/${id}`, 200, response);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

