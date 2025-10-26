import React, { useState } from 'react';
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

  if (!user || user.role !== 'president') {
    return <div>Access Denied</div>;
  }

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

  const handleLogout = () => {
    logout();
    navigate('/login');
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
        <div className="max-w-4xl mx-auto">
          <h1 className='text-3xl font-bold mb-8 text-blue-950'>Create Handbook Page</h1>

          <div className='bg-white p-6 rounded-lg shadow-md'>
            <form onSubmit={handleSubmit}>
              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>
                  Page Title
                </label>
                <input
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
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
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
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

              <button
                type='submit'
                disabled={submitting}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  submitting
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {submitting ? 'Creating...' : 'Create Handbook Page'}
              </button>
            </form>
          </div>

        </div>
      </main>
    </div>
  );
};

export default PresidentHandbook;

