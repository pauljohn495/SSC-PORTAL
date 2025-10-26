import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ActivityLogs = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  if (!user || user.role !== 'admin') {
    return <div>Access Denied</div>;
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/admin/activity-logs');
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
    return `${Math.floor(diffInSeconds / 31536000)} years ago`;
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'login':
        return 'text-blue-600';
      case 'handbook':
        return 'text-green-600';
      case 'memorandum':
        return 'text-purple-600';
      case 'user_management':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'login':
        return '🔐';
      case 'handbook':
        return '📚';
      case 'memorandum':
        return '📄';
      case 'user_management':
        return '👥';
      default:
        return '📝';
    }
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
          <li><Link to="/admin-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 bg-blue-800 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className='text-3xl font-bold mb-8 text-blue-950'>Activity Logs</h1>

          {loading ? (
            <div className='text-center py-8'>
              <p className='text-gray-500'>Loading activity logs...</p>
            </div>
          ) : (
            <div className='bg-white rounded-lg shadow-md'>
              {logs.length > 0 ? (
                <div>
                  {logs.map((log, index) => {
                    const timeAgo = getTimeAgo(log.timestamp);
                    const formattedDate = formatDate(log.timestamp);
                    
                    return (
                      <div key={log._id} className={`flex items-center border-b border-gray-200 hover:bg-gray-50 ${index === 0 ? 'rounded-t-lg' : ''} ${index === logs.length - 1 ? 'rounded-b-lg border-b-0' : ''}`}>
                        <div className='flex-1 px-6 py-4'>
                          <p className='text-gray-800 font-medium'>
                            {log.action.charAt(0).toUpperCase() + log.action.slice(1).replace('_', ' ')} - {log.description}
                          </p>
                        </div>
                        <div className='w-32 px-6 py-4 text-sm text-gray-600'>{timeAgo}</div>
                        <div className='w-48 px-6 py-4 text-sm text-gray-600'>{formattedDate}</div>
                        <div className='w-32 px-6 py-4 text-sm text-gray-600'>None</div>
                        <div className='w-32 px-6 py-4 flex items-center justify-end space-x-2'>
                          <button className='text-blue-600 hover:text-blue-800 transition-colors'>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className='text-center py-12 text-gray-500'>No activity logs found.</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ActivityLogs;
