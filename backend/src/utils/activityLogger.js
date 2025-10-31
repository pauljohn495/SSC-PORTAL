import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';

export const logActivity = async (userId, action, description, details = null, req = null) => {
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

