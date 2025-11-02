import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { presidentAPI } from '../services/api';

const PresidentNotifications = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [messageAlert, setMessageAlert] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const isAuthorized = !!user && user.role === 'president';

  useEffect(() => {
    if (isAuthorized) {
      fetchNotifications();
    }
  }, [isAuthorized]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const data = await presidentAPI.getNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title || !message) {
      setMessageAlert('Please fill in all fields.');
      setMessageType('error');
      return;
    }

    try {
      setSubmitting(true);
      
      const data = await presidentAPI.createNotification({
        title,
        message,
        userId: user._id
      });
      
      setMessageAlert('Notification created successfully!');
      setMessageType('success');
      setTitle('');
      setMessage('');
      setShowModal(false);
      fetchNotifications();
    } catch (error) {
      console.error('Error creating notification:', error);
      setMessageAlert(error.message || 'Error creating notification. Please try again.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (notificationId) => {
    if (!window.confirm('Are you sure you want to publish this notification? It will be sent to all users via email.')) {
      return;
    }

    try {
      setPublishingId(notificationId);
      setMessageAlert('');
      await presidentAPI.publishNotification(notificationId, user._id);
      setMessageAlert('Notification published and emails sent successfully!');
      setMessageType('success');
      // Refresh notifications list immediately
      await fetchNotifications();
    } catch (error) {
      console.error('Error publishing notification:', error);
      setMessageAlert(error.message || 'Error publishing notification. Please try again.');
      setMessageType('error');
    } finally {
      setPublishingId(null);
    }
  };

  const handleDelete = async (notificationId, notificationTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${notificationTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(notificationId);
      setMessageAlert('');
      await presidentAPI.deleteNotification(notificationId, user._id);
      setMessageAlert('Notification deleted successfully!');
      setMessageType('success');
      // Refresh notifications list immediately
      await fetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
      setMessageAlert(error.message || 'Error deleting notification. Please try again.');
      setMessageType('error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className='bg-white min-h-screen flex'>
      {/* Sidebar Panel */}
      <aside className='bg-blue-950 text-white w-64 min-h-screen p-4'>
        <div className='mb-8'>
          <div className='flex items-center justify-center space-x-4 mb-4'>
            <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-20 h-auto' />
            <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='w-20 h-auto' />
          </div>
          <div className='text-center'>
            <span className='text-sm font-bold leading-none'>BUKIDNON STATE UNIVERSITY</span>
            <br />
            <span className='text-xs font-semibold leading-none'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <ul className='space-y-4'>
          <li><Link to="/president-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/president-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/president-notifications" className="block py-2 px-4 bg-blue-800 rounded transition">Notifications</Link></li>
          <li><Link to="/president-activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          {!isAuthorized ? (
            <div>Access Denied</div>
          ) : (
          <>
          <div className='flex justify-between items-center mb-8'>
            <h1 className='text-3xl font-bold text-blue-950'>Notifications</h1>
            <button
              onClick={() => setShowModal(true)}
              className='bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors'
            >
              Create Notification
            </button>
          </div>

          {messageAlert && (
            <div className={`mb-4 p-4 rounded-lg ${
              messageType === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {messageAlert}
            </div>
          )}

          {/* Notifications List */}
          <div className='bg-white rounded-lg shadow-md mb-8'>
            {loading ? (
              <div className='text-center py-12 text-gray-500'>Loading...</div>
            ) : notifications.length === 0 ? (
              <div className='text-center py-12 text-gray-500'>No notifications created yet</div>
            ) : (
              <div>
                {notifications.map((notification, index) => (
                  <div key={notification._id} className={`flex items-center justify-between border-b border-gray-200 hover:bg-gray-50 p-6 ${
                    index === 0 ? 'rounded-t-lg' : ''
                  } ${index === notifications.length - 1 ? 'rounded-b-lg border-b-0' : ''}`}>
                    <div className='flex-1'>
                      <div className='flex items-center space-x-2 mb-2'>
                        <h3 className='text-lg font-semibold text-blue-950'>{notification.title}</h3>
                        {notification.published ? (
                          <span className='px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full font-semibold'>
                            Published
                          </span>
                        ) : (
                          <span className='px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full font-semibold'>
                            Draft
                          </span>
                        )}
                        {notification.emailSent && (
                          <span className='px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full'>
                            Email Sent
                          </span>
                        )}
                      </div>
                      <p className='text-gray-600 mb-2 whitespace-pre-wrap'>{notification.message}</p>
                      <div className='text-sm text-gray-400'>
                        Created: {formatDate(notification.createdAt)}
                        {notification.publishedAt && ` | Published: ${formatDate(notification.publishedAt)}`}
                      </div>
                    </div>
                    <div className='flex items-center space-x-2 ml-4'>
                      {!notification.published && (
                        <button
                          onClick={() => handlePublish(notification._id)}
                          disabled={publishingId === notification._id}
                          className='bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          {publishingId === notification._id ? 'Publishing...' : 'Publish'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification._id, notification.title)}
                        disabled={deletingId === notification._id}
                        className='bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                        title="Delete notification"
                      >
                        {deletingId === notification._id ? (
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </main>

      
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-blue-950 mb-4">Create Notification</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                  placeholder="Enter notification title"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                  placeholder="Enter notification message"
                  rows={6}
                  required
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setTitle('');
                    setMessage('');
                    setMessageAlert('');
                  }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Notification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresidentNotifications;

