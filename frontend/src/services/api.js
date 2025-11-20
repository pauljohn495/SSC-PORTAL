const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

// Helper function to handle API requests
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add body if present
  if (options.body && config.method !== 'GET') {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, config);
    
    // Check for API log header and log to browser console (for both success and error responses)
    const apiLogHeader = response.headers.get('X-API-Log');
    if (apiLogHeader) {
      try {
        const logData = JSON.parse(apiLogHeader);
        console.log('[API Log]', JSON.stringify(logData, null, 2));
      } catch (e) {
        // Silently ignore parsing errors
      }
    }
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(errorData.message || `Request failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API request error:', error);
    throw error;
  }
};

// Auth API
export const authAPI = {
  googleAuth: (userData) => apiRequest('/auth/google', {
    method: 'POST',
    body: userData,
  }),
  adminLogin: (credentials) => apiRequest('/auth/admin', {
    method: 'POST',
    body: credentials,
  }),
  forgotPassword: (email) => apiRequest('/auth/forgot-password', {
    method: 'POST',
    body: { email },
  }),
  resetPassword: (token, newPassword) => apiRequest('/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
  }),
  registerFcmToken: ({ userId, fcmToken }) => apiRequest('/auth/fcm-token', {
    method: 'POST',
    body: { userId, fcmToken },
  }),
  updateProfile: (userId, data) => apiRequest(`/auth/profile/${userId}`, {
    method: 'PUT',
    body: data,
  }),
};

// Admin API
export const adminAPI = {
  getUsers: () => apiRequest('/admin/users'),
  addAdmin: (adminData) => apiRequest('/admin/add-admin', {
    method: 'POST',
    body: adminData,
  }),
  deleteUser: (userId) => apiRequest(`/admin/users/${userId}`, {
    method: 'DELETE',
  }),
  restoreUser: (userId) => apiRequest(`/admin/users/${userId}/restore`, {
    method: 'PUT',
  }),
  getHandbooks: () => apiRequest('/admin/handbook'),
  updateHandbookStatus: (id, status) => apiRequest(`/admin/handbook/${id}`, {
    method: 'PUT',
    body: { status },
  }),
  deleteHandbook: (id) => apiRequest(`/admin/handbook/${id}`, {
    method: 'DELETE',
  }),
  restoreHandbook: (id) => apiRequest(`/admin/handbook/${id}/restore`, {
    method: 'PUT',
  }),
  deleteHandbookPermanent: (id) => apiRequest(`/admin/handbook/${id}/permanent`, {
    method: 'DELETE',
  }),
  getMemorandums: () => apiRequest('/admin/memorandums'),
  updateMemorandumStatus: (id, status) => apiRequest(`/admin/memorandums/${id}`, {
    method: 'PUT',
    body: { status },
  }),
  deleteMemorandum: (id) => apiRequest(`/admin/memorandums/${id}`, {
    method: 'DELETE',
  }),
  restoreMemorandum: (id) => apiRequest(`/admin/memorandums/${id}/restore`, {
    method: 'PUT',
  }),
  deleteMemorandumPermanent: (id) => apiRequest(`/admin/memorandums/${id}/permanent`, {
    method: 'DELETE',
  }),
  getActivityLogs: () => apiRequest('/admin/activity-logs'),
  getArchivedItems: () => apiRequest('/admin/archived'),
};

// President API
export const presidentAPI = {
  // Memorandum routes
  uploadMemorandum: (data) => apiRequest('/president/memorandums', {
    method: 'POST',
    body: data,
  }),
  setMemorandumPriority: (id, userId) => apiRequest(`/president/memorandums/${id}/priority`, {
    method: 'POST',
    body: { userId },
  }),
  updateMemorandum: (id, data) => apiRequest(`/president/memorandums/${id}`, {
    method: 'PUT',
    body: data,
  }),
  clearMemorandumPriority: (id, userId) => apiRequest(`/president/memorandums/${id}/clear-priority`, {
    method: 'POST',
    body: { userId },
  }),
  
  // Handbook routes
  createHandbook: (data) => apiRequest('/president/handbook', {
    method: 'POST',
    body: data,
  }),
  setHandbookPriority: (id, userId) => apiRequest(`/president/handbook/${id}/priority`, {
    method: 'POST',
    body: { userId },
  }),
  updateHandbook: (id, data) => apiRequest(`/president/handbook/${id}`, {
    method: 'PUT',
    body: data,
  }),
  clearHandbookPriority: (id, userId) => apiRequest(`/president/handbook/${id}/clear-priority`, {
    method: 'POST',
    body: { userId },
  }),
  
  // Activity logs
  getUserActivityLogs: (userId) => apiRequest(`/president/activity-logs?userId=${userId}`),
  
  // Notification routes
  createNotification: (data) => apiRequest('/president/notifications', {
    method: 'POST',
    body: data,
  }),
  publishNotification: (id, userId) => apiRequest(`/president/notifications/${id}/publish`, {
    method: 'POST',
    body: { userId },
  }),
  deleteNotification: (id, userId) => apiRequest(`/president/notifications/${id}`, {
    method: 'DELETE',
    body: { userId },
  }),
  getNotifications: () => apiRequest('/president/notifications'),
};

// Public API
export const publicAPI = {
  getPublicHandbooks: () => apiRequest('/handbook'),
  getPublicMemorandums: () => apiRequest('/memorandums'),
  getPublicNotifications: () => apiRequest('/notifications'),
};

export default {
  auth: authAPI,
  admin: adminAPI,
  president: presidentAPI,
  public: publicAPI,
};

