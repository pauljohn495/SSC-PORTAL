import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PresidentActivityLogs = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  if (!user || user.role !== 'president') {
    return <div>Access Denied</div>;
  }

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/admin/activity-logs');
      const data = await response.json();
      // Filter logs for current user's actions
      const userLogs = data.filter(log => 
        log.user && (log.user._id === user._id || log.user.email === user.email)
      );
      setLogs(userLogs);
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
          <li><Link to="/president-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/president-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/president-activity-logs" className="block py-2 px-4 bg-blue-800 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className='text-3xl font-bold mb-8 text-blue-950'>My Activity Logs</h1>

          {/* Logs Display */}
          {loading ? (
            <div className='text-center py-8'>
              <p className='text-gray-500'>Loading activity logs...</p>
            </div>
          ) : (
            <div className='space-y-4'>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <div key={log._id} className='bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='flex items-center space-x-3 mb-2'>
                          <span className='text-2xl'>{getActionIcon(log.action)}</span>
                          <h3 className={`text-lg font-semibold ${getActionColor(log.action)}`}>
                            {log.action.charAt(0).toUpperCase() + log.action.slice(1).replace('_', ' ')}
                          </h3>
                        </div>
                        <p className='text-gray-700 mb-2'>{log.description}</p>
                        <div className='flex flex-wrap gap-4 text-sm text-gray-600'>
                          <span><strong>Date:</strong> {formatDate(log.timestamp)}</span>
                        </div>
                        {log.details && (
                          <div className='mt-3 p-3 bg-gray-50 rounded'>
                            <p className='text-sm text-gray-600'><strong>Details:</strong> {log.details}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className='text-center py-8'>
                  <p className='text-gray-500'>No activity logs found for the selected filter.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PresidentActivityLogs;

