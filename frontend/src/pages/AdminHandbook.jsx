import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminHandbook = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAuthorized = !!user && user.role === 'admin';

  useEffect(() => {
    if (isAuthorized) {
      fetchDrafts();
    }
  }, [isAuthorized]);

  const fetchDrafts = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/admin/handbook');
      
      // Check for API log header and log to browser console
      const apiLogHeader = response.headers.get('X-API-Log');
      if (apiLogHeader) {
        try {
          const logData = JSON.parse(apiLogHeader);
          console.log('[API Log]', JSON.stringify(logData, null, 2));
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      const data = await response.json();
      setDrafts(data);
    } catch (error) {
      console.error('Error fetching handbook drafts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const response = await fetch(`http://localhost:5001/api/admin/handbook/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      
      // Check for API log header and log to browser console
      const apiLogHeader = response.headers.get('X-API-Log');
      if (apiLogHeader) {
        try {
          const logData = JSON.parse(apiLogHeader);
          console.log('[API Log]', JSON.stringify(logData, null, 2));
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      if (response.ok) {
        fetchDrafts(); // Refresh list
      }
    } catch (error) {
      console.error('Error approving handbook:', error);
    }
  };

  const handleReject = async (id) => {
    try {
      const response = await fetch(`http://localhost:5001/api/admin/handbook/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      
      // Check for API log header and log to browser console
      const apiLogHeader = response.headers.get('X-API-Log');
      if (apiLogHeader) {
        try {
          const logData = JSON.parse(apiLogHeader);
          console.log('[API Log]', JSON.stringify(logData, null, 2));
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      if (response.ok) {
        fetchDrafts(); // Refresh list
      }
    } catch (error) {
      console.error('Error rejecting handbook:', error);
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Are you sure you want to archive this handbook page?')) {
      return;
    }
    try {
      const response = await fetch(`http://localhost:5001/api/admin/handbook/${id}`, {
        method: 'DELETE'
      });
      
      // Check for API log header and log to browser console
      const apiLogHeader = response.headers.get('X-API-Log');
      if (apiLogHeader) {
        try {
          const logData = JSON.parse(apiLogHeader);
          console.log('[API Log]', JSON.stringify(logData, null, 2));
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      if (response.ok) {
        fetchDrafts(); // Refresh list
      }
    } catch (error) {
      console.error('Error deleting handbook:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
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

  return (
    <div className='bg-white min-h-screen flex'>
      {/* Sidebar Panel */}
      <aside className='bg-blue-950 text-white w-64 min-h-screen p-4'>
        <div className='mb-8'>
          <div className='flex items-center justify-center space-x-4 mb-4'>
            <Link to="/" className='flex items-center space-x-4'>
              <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-20 h-auto' />
              <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='w-20 h-auto' />
            </Link>
          </div>
          <div className='text-center'>
            <span className='text-sm font-bold leading-none'>BUKIDNON STATE UNIVERSITY</span>
            <br />
            <span className='text-xs font-semibold leading-none'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <ul className='space-y-4'>
          <li><Link to="/admin-handbook" className="block py-2 px-4 bg-blue-800 rounded transition">Handbook</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><Link to="/archived" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Archived</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          {!isAuthorized ? (
            <div>Access Denied</div>
          ) : (
          <h1 className='text-3xl font-bold mb-8 text-blue-950'>Handbook Drafts</h1>
          )}
          
          {isAuthorized && (loading ? (
            <p>Loading...</p>
          ) : (
            <div className='bg-white rounded-lg shadow-md'>
              {drafts.length > 0 ? (
                <div>
                  {drafts.map((draft, index) => {
                    const createdAt = new Date(draft.createdAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    });
                    const timeAgo = getTimeAgo(draft.createdAt);
                    
                    return (
                      <div key={draft._id} className={`flex items-center border-b border-gray-200 hover:bg-gray-50 ${index === 0 ? 'rounded-t-lg' : ''} ${index === drafts.length - 1 ? 'rounded-b-lg border-b-0' : ''}`}>
                        <div className='flex-1 px-6 py-4'>
                          <div className='flex items-center space-x-2'>
                            <p className='text-gray-800 font-medium'>Page {draft.pageNumber || 'N/A'}</p>
                          </div>
                          <p className='text-sm text-gray-500 mt-1 truncate'>{draft.content ? draft.content.substring(0, 100) + '...' : 'No content'}</p>
                        </div>
                        <div className='w-32 px-6 py-4 text-sm text-gray-600'>{timeAgo}</div>
                        <div className='w-32 px-6 py-4 text-sm text-gray-600'>{createdAt}</div>
                        <div className='w-32 px-6 py-4'>
                          <span className={`font-semibold ${draft.status === 'approved' ? 'text-green-600' : draft.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                            {draft.status}
                          </span>
                        </div>
                        <div className='w-32 px-6 py-4 flex items-center justify-end space-x-2'>
                          {draft.status === 'draft' && (
                            <>
                              <button
                                onClick={() => handleApprove(draft._id)}
                                className='text-green-600 hover:text-green-800 transition-colors'
                                title='Approve'
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleReject(draft._id)}
                                className='text-red-600 hover:text-red-800 transition-colors'
                                title='Reject'
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleArchive(draft._id)}
                            className='text-gray-400 hover:text-orange-600 transition-colors'
                            title='Archive'
                          >
                            <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className='text-center py-12 text-gray-500'>No handbook drafts available.</div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminHandbook;
