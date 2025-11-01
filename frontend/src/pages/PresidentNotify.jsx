import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PresidentNotify = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [messageAlert, setMessageAlert] = useState('');
  const [messageType, setMessageType] = useState('');

  const isAuthorized = !!user && user.role === 'president';

  useEffect(() => {
    if (isAuthorized) {
      fetchNotifications();
    }
  }, [isAuthorized]);

  const fetchNotifications = async () => {
    try {
      const response = await fetch('/api/notifications');
      const data = await response.json();
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
      
      const response = await fetch('/api/president/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          message,
          userId: user._id
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessageAlert('Notification created successfully!');
        setMessageType('success');
        setTitle('');
        setMessage('');
        setShowModal(false);
        fetchNotifications();
      } else {
        setMessageAlert(data.message || 'Failed to create notification. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error creating notification:', error);
      setMessageAlert('Error creating notification. Please try again.');
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
      const response = await fetch(`/api/president/notifications/${notificationId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessageAlert('Notification published successfully! Email sent to all users.');
        setMessageType('success');
        fetchNotifications();
      } else {
        setMessageAlert(data.message || 'Failed to publish notification.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error publishing notification:', error);
      setMessageAlert('Error publishing notification. Please try again.');
      setMessageType('error');
    }
  };

  const handleDelete = async (notificationId) => {
    if (!window.confirm('Are you sure you want to delete this notification?')) {
      return;
    }

    try {
      const response = await fetch(`/api/president/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessageAlert('Notification deleted successfully!');
        setMessageType('success');
        fetchNotifications();
      } else {
        setMessageAlert(data.message || 'Failed to delete notification.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      setMessageAlert('Error deleting notification. Please try again.');
      setMessageType('error');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Not published';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  };

  if (!isAuthorized) {
    return <div>Access Denied</div>;
  }

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
          <li><Link to="/president-notify" className="block py-2 px-4 bg-blue-800 rounded transition">Notify</Link></li>
          <li><Link to="/president-activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
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
            <div className={`mb-6 p-4 rounded-lg ${
              messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {messageAlert}
            </div>
          )}

          {/* Notifications List */}
          <div className='bg-white rounded-lg shadow-md mb-8'>
            {loading ? (
              <div className='text-center py-12 text-gray-500'>Loading...</div>
            ) : notifications.length > 0 ? (
              <div>
                {notifications.map((notification, index) => (
                  <div key={notification._id} className={`flex items-center border-b border-gray-200 hover:bg-gray-50 ${index === 0 ? 'rounded-t-lg' : ''} ${index === notifications.length - 1 ? 'rounded-b-lg border-b-0' : ''}`}>
                    <div className='flex-1 px-6 py-4'>
                      <div className='flex items-center space-x-2'>
                        <p className='text-gray-800 font-medium'>{notification.title}</p>
                        {notification.isPublished && (
                          <span className='px-2 py-1 bg-green-600 text-white text-xs rounded-full'>
                            Published
                          </span>
                        )}
                      </div>
                      <p className='text-sm text-gray-500 mt-1'>{notification.message}</p>
                      <p className='text-xs text-gray-400 mt-1'>
                        Created by: {notification.createdBy ? notification.createdBy.name : 'Unknown'}
                      </p>
                      {notification.publishedAt && (
                        <p className='text-xs text-gray-400 mt-1'>
                          Published: {getTimeAgo(notification.publishedAt)}
                        </p>
                      )}
                    </div>
                    <div className='px-6 py-4 flex items-center space-x-2'>
                      {!notification.isPublished && (
                        <button
                          onClick={() => handlePublish(notification._id)}
                          className='bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors'
                        >
                          Publish
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification._id)}
                        className='bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm transition-colors'
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-center py-12 text-gray-500'>No notifications yet. Click "Create Notification" to add one.</div>
            )}
          </div>
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <h2 className='text-2xl font-bold mb-6 text-blue-950'>Create Notification</h2>

            <form onSubmit={handleSubmit}>
              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>
                  Title
                </label>
                <input
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  placeholder='Enter notification title'
                  required
                />
              </div>

              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  placeholder='Enter notification message'
                  rows='8'
                  required
                />
              </div>

              {messageAlert && (
                <div className={`mb-6 p-4 rounded-lg ${
                  messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {messageAlert}
                </div>
              )}

              <div className='flex space-x-4'>
                <button
                  type='submit'
                  disabled={submitting}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                    submitting
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {submitting ? 'Creating...' : 'Create Notification'}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setShowModal(false);
                    setTitle('');
                    setMessage('');
                    setMessageAlert('');
                    setMessageType('');
                  }}
                  disabled={submitting}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    submitting
                      ? 'bg-gray-200 cursor-not-allowed'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresidentNotify;

