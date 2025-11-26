import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AddAdmin = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [adminForm, setAdminForm] = useState({ email: '' });
  const [message, setMessage] = useState('');

  if (!user || user.role !== 'admin') {
    return <div>Access Denied</div>;
  }

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5001/api/admin/add-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm)
      });
      const data = await response.json();
      setMessage(data.message);
      if (response.ok) {
        setAdminForm({ email: '' });
      }
    } catch (error) {
      setMessage('Error creating admin account');
    }
  };

  return (
    <div className='bg-white min-h-screen flex'>
      {/* Sidebar Panel */}
      <aside className='bg-blue-950 text-white w-64 min-h-screen p-4'>
        <div className='mb-8'>
          <div className='flex items-center justify-center space-x-4 mb-4'>
            <a href="/" className='flex items-center space-x-4'>
              <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-20 h-auto' />
              <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='w-20 h-auto' />
            </a>
          </div>
          <div className='text-center'>
            <span className='text-sm font-bold leading-none'>BUKIDNON STATE UNIVERSITY</span>
            <br />
            <span className='text-xs font-semibold leading-none'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <ul className='space-y-4'>
          <li><Link to="/admin-dashboard" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Dashboard</Link></li>
          <li><Link to="/admin-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/admin-policy" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Policy</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Manage User</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className='text-3xl font-bold mb-8 text-blue-950'>Create Admin Account</h1>

          {message && (
            <div className='mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded'>
              {message}
            </div>
          )}

          <div className='bg-white p-6 rounded-lg shadow-md'>
            <p className='text-sm text-gray-600 mb-4'>Add a new admin by entering their email address. They will receive an email with a link to complete their account setup (create username and password).</p>
            <form onSubmit={handleAddAdmin} className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Email</label>
                <input
                  type='email'
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                  className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='admin@example.com'
                  required
                />
              </div>
              <button
                type='submit'
                className='bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors'
              >
                Send Admin Invitation
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AddAdmin;
