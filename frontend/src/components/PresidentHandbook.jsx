import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PresidentHandbook = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [handbooks, setHandbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingHandbook, setEditingHandbook] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  if (!user || user.role !== 'president') {
    return <div>Access Denied</div>;
  }

  useEffect(() => {
    fetchHandbooks();
  }, []);

  const fetchHandbooks = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/admin/handbook');
      const data = await response.json();
      // Filter to show only handbooks created by the current president
      const presidentHandbooks = data.filter(hb => hb.createdBy && hb.createdBy._id === user._id);
      setHandbooks(presidentHandbooks);
    } catch (error) {
      console.error('Error fetching handbooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!title || !content) {
      setMessage('Please fill in all fields.');
      setMessageType('error');
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await fetch('http://localhost:5001/api/handbook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          userId: user._id
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Handbook page created successfully! Waiting for admin approval.');
        setMessageType('success');
        setTitle('');
        setContent('');
        setShowModal(false);
        fetchHandbooks(); // Refresh the list
      } else {
        setMessage(data.message || 'Failed to create handbook page. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error creating handbook page:', error);
      setMessage('Error creating handbook page. Please try again.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (handbook) => {
    setEditingHandbook(handbook);
    setEditTitle(handbook.title);
    setEditContent(handbook.content);
    setShowModal(true);
    setTitle('');
    setContent('');
    setMessage('');
    setMessageType('');
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    if (!editTitle || !editContent) {
      setMessage('Please fill in all fields.');
      setMessageType('error');
      return;
    }

    try {
      setSubmitting(true);
      
      const response = await fetch(`http://localhost:5001/api/handbook/${editingHandbook._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          content: editContent,
          userId: user._id
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Handbook page updated successfully! Waiting for admin approval.');
        setMessageType('success');
        setEditingHandbook(null);
        setEditTitle('');
        setEditContent('');
        setShowModal(false);
        fetchHandbooks(); // Refresh the list
      } else {
        setMessage(data.message || 'Failed to update handbook page. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error updating handbook page:', error);
      setMessage('Error updating handbook page. Please try again.');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingHandbook(null);
    setTitle('');
    setContent('');
    setEditTitle('');
    setEditContent('');
    setMessage('');
    setMessageType('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      case 'draft':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
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
          <li><Link to="/president-handbook" className="block py-2 px-4 bg-blue-800 rounded transition">Handbook</Link></li>
          <li><Link to="/president-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/president-activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          <div className='flex justify-between items-center mb-8'>
            <h1 className='text-3xl font-bold text-blue-950'>Handbook Pages</h1>
            <button
              onClick={() => setShowModal(true)}
              className='bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors'
            >
              Create Handbook
            </button>
          </div>

          {/* Handbook List */}
          <div className='bg-white rounded-lg shadow-md mb-8'>
            {loading ? (
              <div className='text-center py-12 text-gray-500'>Loading...</div>
            ) : handbooks.length > 0 ? (
              <div>
                {handbooks.map((handbook, index) => {
                  const createdAt = new Date(handbook.createdAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  });
                  const timeAgo = getTimeAgo(handbook.createdAt);
                  
                  return (
                    <div key={handbook._id} className={`flex items-center border-b border-gray-200 hover:bg-gray-50 ${index === 0 ? 'rounded-t-lg' : ''} ${index === handbooks.length - 1 ? 'rounded-b-lg border-b-0' : ''}`}>
                      <div className='flex-1 px-6 py-4'>
                        <p className='text-gray-800 font-medium'>{handbook.title}</p>
                        <p className='text-sm text-gray-500 mt-1 truncate'>{handbook.content.substring(0, 100)}...</p>
                      </div>
                      <div className='w-32 px-6 py-4 text-sm text-gray-600'>{timeAgo}</div>
                      <div className='w-28 px-6 py-4 text-sm text-gray-600'>{createdAt}</div>
                      <div className='w-32 px-6 py-4'>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(handbook.status)}`}>
                          {handbook.status}
                        </span>
                      </div>
                      <div className='w-20 px-6 py-4 flex items-center justify-end'>
                        <button
                          onClick={() => handleEdit(handbook)}
                          className='text-blue-600 hover:text-blue-800 transition-colors'
                          title='Edit'
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className='text-center py-12 text-gray-500'>No handbook pages yet. Click "Create Handbook" to add one.</div>
            )}
          </div>
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <h2 className='text-2xl font-bold mb-6 text-blue-950'>
              {editingHandbook ? 'Edit Handbook Page' : 'Create Handbook Page'}
            </h2>

            <form onSubmit={editingHandbook ? handleUpdate : handleSubmit}>
              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>
                  Page Title
                </label>
                <input
                  type='text'
                  value={editingHandbook ? editTitle : title}
                  onChange={(e) => editingHandbook ? setEditTitle(e.target.value) : setTitle(e.target.value)}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  placeholder='Enter handbook page title'
                  required
                />
              </div>

              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2 text-black'>
                  Content
                </label>
                <textarea
                  value={editingHandbook ? editContent : content}
                  onChange={(e) => editingHandbook ? setEditContent(e.target.value) : setContent(e.target.value)}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  placeholder='Enter handbook page content'
                  rows='12'
                  required
                />
              </div>

              {message && (
                <div className={`mb-6 p-4 rounded-lg ${
                  messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {message}
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
                  {submitting ? (editingHandbook ? 'Updating...' : 'Creating...') : (editingHandbook ? 'Update Handbook Page' : 'Create Handbook Page')}
                </button>
                <button
                  type='button'
                  onClick={closeModal}
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

export default PresidentHandbook;
