import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const ManageUsers = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPresident, setShowAddPresident] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [presidentEmail, setPresidentEmail] = useState('');
  const [adminForm, setAdminForm] = useState({ name: '', email: '' });
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user && user.role === 'admin') {
      fetchUsers();
    }
  }, [user]);

  if (!user || user.role !== 'admin') {
    return <div>Access Denied</div>;
  }

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5001/api/admin/users');
      
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
      // Show all users, not just admin and president
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };



  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleAddPresident = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setMessage('');
    
    // Basic email validation
    if (!presidentEmail || !presidentEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address');
      return;
    }
    
    try {
      const response = await fetch('http://localhost:5001/api/admin/add-president', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: presidentEmail })
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
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage(data.message);
        setPresidentEmail('');
        setShowAddPresident(false);
        fetchUsers(); // Refresh the list to show the new president
      } else {
        console.log('Error response:', response.status, data);
        const errorMsg = data.details ? `${data.message}: ${data.details}` : data.message;
        setErrorMessage(errorMsg || 'Error adding president email');
      }
    } catch (error) {
      console.error('Error adding president:', error);
      setErrorMessage('Network error. Please try again.');
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setMessage('');
    
    try {
      const response = await fetch('http://localhost:5001/api/admin/add-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminForm)
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
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage(data.message);
        setAdminForm({ name: '', email: '' });
        setShowAddAdmin(false);
        fetchUsers(); // Refresh the list to show the new admin
      } else {
        setErrorMessage(data.message || 'Error creating admin account');
      }
    } catch (error) {
      console.error('Error creating admin:', error);
      setErrorMessage('Network error. Please try again.');
    }
  };

  const handleArchiveUser = async (userId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Archive User',
      text: 'Are you sure you want to archive this user? They will no longer be able to access the system.',
      showCancelButton: true,
      confirmButtonColor: '#f97316',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, archive it'
    });
    if (!result.isConfirmed) {
      return;
    }
    try {
      const response = await fetch(`http://localhost:5001/api/admin/users/${userId}/archive`, {
        method: 'PUT'
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
      
      const data = await response.json();
      setMessage(data.message);
      if (response.ok) {
        setUsers(users.filter(user => user._id !== userId)); // Remove from list immediately
      }
    } catch (error) {
      console.error('Error archiving user:', error);
      setMessage('Error archiving user');
    }
  };

  const handleCleanupDatabase = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/admin/cleanup-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      
      if (response.ok) {
        setMessage('Database cleanup completed successfully');
      } else {
        setErrorMessage(data.message || 'Error during cleanup');
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
      setErrorMessage('Network error during cleanup');
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
          <li><Link to="/admin-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/admin-policy" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Policy</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 bg-blue-800 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><Link to="/archived" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Archived</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className='text-3xl font-bold mb-8 text-blue-950'>Manage Users</h1>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 items-start'>
            {/* Add President Section */}
            <div className='bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow'>
              <h2 className='text-xl font-semibold mb-4 text-gray-800'>Add President Email</h2>
              <p className='text-sm text-gray-600 mb-4'>Add any email address that will be recognized as a president account. The user will be able to login with Google using this email.</p>
              <button
                onClick={() => setShowAddPresident(!showAddPresident)}
                className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors'
              >
                {showAddPresident ? 'Cancel' : 'Add President'}
              </button>
              {showAddPresident && (
                <form onSubmit={handleAddPresident} className='mt-4 space-y-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>President Email</label>
                    <input
                      type='email'
                      value={presidentEmail}
                      onChange={(e) => {
                        setPresidentEmail(e.target.value);
                        setErrorMessage('');
                      }}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900'
                      required
                    />
                  </div>
                  <button
                    type='submit'
                    className='bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors'
                  >
                    Add President
                  </button>
                </form>
              )}
            </div>

            {/* Add Admin Section */}
            <div className='bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow'>
              <h2 className='text-xl font-semibold mb-4 text-gray-800'>Create Admin Account</h2>
              <p className='text-sm text-gray-600 mb-4'>Create a new admin account. The admin will receive an email to complete their account setup.</p>
              <button
                onClick={() => setShowAddAdmin(!showAddAdmin)}
                className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors'
              >
                {showAddAdmin ? 'Cancel' : 'Create Admin'}
              </button>
              {showAddAdmin && (
                <form onSubmit={handleAddAdmin} className='mt-4 space-y-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>Full Name</label>
                    <input
                      type='text'
                      value={adminForm.name}
                      onChange={(e) => setAdminForm({...adminForm, name: e.target.value})}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900'
                      required
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>Email</label>
                    <input
                      type='email'
                      value={adminForm.email}
                      onChange={(e) => setAdminForm({...adminForm, email: e.target.value})}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900'
                      required
                    />
                  </div>
                  <button
                    type='submit'
                    className='bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors'
                  >
                    Create Admin
                  </button>
                </form>
              )}
            </div>
          </div>

          {message && (
            <div className='mb-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded'>
              {message}
            </div>
          )}

          {errorMessage && (
            <div className='mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded'>
              {errorMessage}
            </div>
          )}

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className='bg-white rounded-lg shadow-md'>
              <div className='p-6 border-b border-gray-200'>
                <h2 className='text-2xl font-bold text-blue-950'>All Registered Users ({users.length})</h2>
              </div>
              {users.length > 0 ? (
                <div className='divide-y divide-gray-200'>
                  {users.map((user, index) => (
                    <div key={user._id} className={`p-6 hover:bg-gray-50 transition-colors ${index === 0 ? 'rounded-t-lg' : ''} ${index === users.length - 1 ? 'rounded-b-lg' : ''}`}>
                      <div className='flex items-center justify-between'>
                        <div className='flex-1'>
                          <div className='flex items-center space-x-3 mb-2'>
                            <h3 className='text-lg font-semibold text-gray-800'>{user.name || user.email}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              user.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                              user.role === 'president' ? 'bg-purple-100 text-purple-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {user.role?.toUpperCase() || 'STUDENT'}
                            </span>
                          </div>
                          <div className='grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600'>
                            <p><span className='font-medium'>Fullname:</span> {user.name || <span className='italic text-gray-400'>Not set</span>}</p>
                            <p><span className='font-medium'>Email:</span> {user.email}</p>
                            <p><span className='font-medium'>Department:</span> {user.department || <span className='italic text-gray-400'>Not set</span>}</p>
                            <p><span className='font-medium'>Course:</span> {user.course || <span className='italic text-gray-400'>Not set</span>}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleArchiveUser(user._id)}
                          className='ml-4 text-gray-400 hover:text-orange-600 transition-colors p-2'
                          title='Archive user'
                        >
                          <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' />
                          </svg>
                        </button>
                        
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='text-center py-12 text-gray-500'>No users found.</div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ManageUsers;

