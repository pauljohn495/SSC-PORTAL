import React, { useState, useEffect, useRef } from 'react';
import { publicAPI } from '../services/api';
import { subscribeOnMessage } from '../firebase';
import { onEvent } from '../realtime/socket';

const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchNotifications();
    
    // Fetch notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Realtime: update list/badge on FCM foreground/background messages
  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      unsubscribe = await subscribeOnMessage(() => {
        fetchNotifications();
      });
    })();
    const onSwMessage = (event) => {
      if (event?.data?.type === 'fcm-bg') {
        fetchNotifications();
      }
    };
    if (navigator?.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', onSwMessage);
    }
    return () => {
      try { unsubscribe(); } catch {}
      if (navigator?.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage);
      }
    };
  }, []);

  // Realtime: Socket.IO events
  useEffect(() => {
    const off1 = onEvent('notification:published', fetchNotifications);
    const off2 = onEvent('handbook:approved', fetchNotifications);
    const off3 = onEvent('memorandum:approved', fetchNotifications);
    return () => {
      off1 && off1();
      off2 && off2();
      off3 && off3();
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchNotifications = async () => {
    try {
      const data = await publicAPI.getPublicNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications(); // Refresh when opening
    }
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

  const unreadCount = notifications.filter(n => n.published).length;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleDropdown}
        className="relative text-white hover:bg-blue-900 p-2 rounded-lg transition cursor-pointer"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-lg shadow-lg z-50 max-h-96 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-blue-950">Notifications</h3>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            ) : (
              <div className="divide-y divide-gray-200">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className="p-4 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-blue-950 text-sm">
                        {notification.title}
                      </h4>
                      {notification.published && (
                        <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Published
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">
                      {notification.message}
                    </p>
                    <div className="text-xs text-gray-400">
                      {notification.publishedAt
                        ? formatDate(notification.publishedAt)
                        : formatDate(notification.createdAt)}
                    </div>
                    {notification.createdBy && (
                      <div className="text-xs text-gray-400 mt-1">
                        By: {notification.createdBy.name || notification.createdBy.email}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;

