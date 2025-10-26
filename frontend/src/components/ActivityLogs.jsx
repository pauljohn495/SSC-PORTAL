import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ActivityLogs = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, login, handbook, memorandum, user_management

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

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.action === filter;
  });

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

          {/* Filter Section */}
          <div className='bg-white p-6 rounded-lg shadow-md mb-8'>
            <h2 className='text-xl font-semibold mb-4 text-gray-800'>Filter Logs</h2>
            <div className='flex flex-wrap gap-4'>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded transition-colors ${
                  filter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All Activities
              </button>
              <button
                onClick={() => setFilter('login')}
                className={`px-4 py-2 rounded transition-colors ${
                  filter === 'login' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔐 Login Activities
              </button>
              <button
                onClick={() => setFilter('handbook')}
                className={`px-4 py-2 rounded transition-colors ${
                  filter === 'handbook' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📚 Handbook Activities
              </button>
              <button
                onClick={() => setFilter('memorandum')}
                className={`px-4 py-2 rounded transition-colors ${
                  filter === 'memorandum' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                📄 Memorandum Activities
              </button>
              <button
                onClick={() => setFilter('user_management')}
                className={`px-4 py-2 rounded transition-colors ${
                  filter === 'user_management' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                👥 User Management
              </button>
            </div>
          </div>

          {/* Logs Display */}
          {loading ? (
            <div className='text-center py-8'>
              <p className='text-gray-500'>Loading activity logs...</p>
            </div>
          ) : (
            <div className='space-y-4'>
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
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
                          <span><strong>User:</strong> {log.user?.name || log.user?.email || 'Unknown'}</span>
                          <span><strong>IP:</strong> {log.ipAddress || 'N/A'}</span>
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

          {/* Summary Stats */}
          {!loading && logs.length > 0 && (
            <div className='mt-8 bg-white p-6 rounded-lg shadow-md'>
              <h2 className='text-xl font-semibold mb-4 text-gray-800'>Activity Summary</h2>
              <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                <div className='text-center p-4 bg-blue-50 rounded-lg'>
                  <div className='text-2xl font-bold text-blue-600'>{logs.length}</div>
                  <div className='text-sm text-gray-600'>Total Activities</div>
                </div>
                <div className='text-center p-4 bg-green-50 rounded-lg'>
                  <div className='text-2xl font-bold text-green-600'>
                    {logs.filter(log => log.action === 'login').length}
                  </div>
                  <div className='text-sm text-gray-600'>Login Activities</div>
                </div>
                <div className='text-center p-4 bg-purple-50 rounded-lg'>
                  <div className='text-2xl font-bold text-purple-600'>
                    {logs.filter(log => log.action === 'handbook').length}
                  </div>
                  <div className='text-sm text-gray-600'>Handbook Activities</div>
                </div>
                <div className='text-center p-4 bg-orange-50 rounded-lg'>
                  <div className='text-2xl font-bold text-orange-600'>
                    {logs.filter(log => log.action === 'memorandum').length}
                  </div>
                  <div className='text-sm text-gray-600'>Memorandum Activities</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ActivityLogs;
