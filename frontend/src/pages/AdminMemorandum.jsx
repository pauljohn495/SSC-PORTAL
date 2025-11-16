import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const AdminMemorandum = () => {
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
      const response = await fetch('http://localhost:5001/api/admin/memorandums');
      
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
      console.error('Error fetching memorandum drafts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const response = await fetch(`http://localhost:5001/api/admin/memorandums/${id}`, {
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
      console.error('Error approving memorandum:', error);
    }
  };

  const handleReject = async (id) => {
    try {
      const response = await fetch(`http://localhost:5001/api/admin/memorandums/${id}`, {
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
      console.error('Error rejecting memorandum:', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this memorandum?')) {
      return;
    }
    try {
      const response = await fetch(`http://localhost:5001/api/admin/memorandums/${id}`, {
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
      console.error('Error deleting memorandum:', error);
    }
  };

  const handleViewPDF = (fileUrl) => {
    try {
      if (fileUrl && fileUrl.startsWith('data:application/pdf')) {
        const base64Index = fileUrl.indexOf('base64,');
        if (base64Index !== -1) {
          const base64 = fileUrl.substring(base64Index + 7);
          const binaryString = atob(base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const objectUrl = URL.createObjectURL(blob);
          window.open(objectUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      }
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Failed to open PDF:', e);
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
          <li><Link to="/admin-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 bg-blue-800 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          {!isAuthorized ? (
            <div>Access Denied</div>
          ) : (
          <h1 className='text-3xl font-bold mb-8 text-blue-950'>Memorandum Drafts</h1>
          )}
          
          {isAuthorized && (loading ? (
            <p>Loading...</p>
          ) : (
            <div className='bg-white rounded-lg shadow-md'>
              {drafts.length > 0 ? (
                <div>
                  {drafts.map((draft, index) => {
                    const uploadedAt = new Date(draft.uploadedAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    });
                    const timeAgo = getTimeAgo(draft.uploadedAt);
                    
                    return (
                      <div key={draft._id} className={`flex items-center border-b border-gray-200 hover:bg-gray-50 ${index === 0 ? 'rounded-t-lg' : ''} ${index === drafts.length - 1 ? 'rounded-b-lg border-b-0' : ''}`}>
                        <div className='flex-1 px-6 py-4'>
                          <p className='text-gray-800 font-medium'>{draft.title}</p>
                        </div>
                        <div className='w-32 px-6 py-4 text-sm text-gray-600'>{timeAgo}</div>
                        <div className='w-32 px-6 py-4 text-sm text-gray-600'>{uploadedAt}</div>
                        <div className='w-32 px-6 py-4'>
                          <span className={`font-semibold ${draft.status === 'approved' ? 'text-green-600' : draft.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>
                            {draft.status}
                          </span>
                        </div>
                        <div className='w-32 px-6 py-4 flex items-center justify-end space-x-2'>
                          {draft.status === 'draft' && (
                            <>
                              <button
                                onClick={() => handleViewPDF(draft.fileUrl)}
                                className='text-blue-600 hover:text-blue-800 transition-colors'
                                title='View PDF'
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
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
                            onClick={() => handleDelete(draft._id)}
                            className='text-gray-400 hover:text-red-600 transition-colors'
                            title='Delete'
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className='text-center py-12 text-gray-500'>No memorandum drafts available.</div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminMemorandum;
