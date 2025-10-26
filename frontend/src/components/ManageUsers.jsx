import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ManageUsers = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [presidentEmails, setPresidentEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPresident, setShowAddPresident] = useState(false);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [presidentEmail, setPresidentEmail] = useState('');
  const [adminForm, setAdminForm] = useState({ username: '', password: '', name: '', email: '' });
  const [message, setMessage] = useState('');

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
      const response = await fetch('http://localhost:5001/api/admin/users');
      const data = await response.json();
      const filteredUsers = data.filter(user => user.role === 'admin' || user.role === 'president');
      setUsers(filteredUsers);
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
    try {
      const response = await fetch('http://localhost:5001/api/admin/add-president', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: presidentEmail })
      });
      const data = await response.json();
      setMessage(data.message);
      if (response.ok) {
        if (data.user) {
          setUsers([...users, data.user]); // Add the new president to the list immediately
        }
        setPresidentEmails([...presidentEmails, presidentEmail]);
        setPresidentEmail('');
        setShowAddPresident(false);
        fetchUsers(); // Refresh the list to ensure consistency
      }
    } catch (error) {
      setMessage('Error adding president email');
    }
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
        if (data.user) {
          setUsers([...users, data.user]); // Add the new admin to the list immediately
        }
        setAdminForm({ username: '', password: '', name: '', email: '' });
        setShowAddAdmin(false);
        fetchUsers(); // Refresh the list to ensure consistency
      }
    } catch (error) {
      setMessage('Error creating admin account');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) {
      return;
    }
    try {
      const response = await fetch(`http://localhost:5001/api/admin/users/${userId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      console.log('Delete response:', response.status, data);
      setMessage(data.message);
      if (response.ok) {
        setUsers(users.filter(user => user._id !== userId)); // Remove from list immediately
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      setMessage('Error deleting user');
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
          <li><Link to="/manage-users" className="block py-2 px-4 bg-blue-800 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
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
              <p className='text-sm text-gray-600 mb-4'>Add an email address that will be recognized as a president account when they log in.</p>
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
                      onChange={(e) => setPresidentEmail(e.target.value)}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900'
                      placeholder='president@example.com'
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
              <p className='text-sm text-gray-600 mb-4'>Create a new admin account with username and password for manual login.</p>
              <button
                onClick={() => setShowAddAdmin(!showAddAdmin)}
                className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors'
              >
                {showAddAdmin ? 'Cancel' : 'Create Admin'}
              </button>
              {showAddAdmin && (
                <form onSubmit={handleAddAdmin} className='mt-4 space-y-4'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>Username</label>
                    <input
                      type='text'
                      value={adminForm.username}
                      onChange={(e) => setAdminForm({...adminForm, username: e.target.value})}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900'
                      required
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>Password</label>
                    <input
                      type='password'
                      value={adminForm.password}
                      onChange={(e) => setAdminForm({...adminForm, password: e.target.value})}
                      className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900'
                      required
                    />
                  </div>
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

          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
              {/* Presidents Section */}
              <div>
                <h2 className='text-2xl font-bold mb-4 text-blue-950'>Presidents</h2>
                <div className='grid grid-cols-1 gap-6'>
                  {presidentEmails.length > 0 && presidentEmails.map((email, index) => (
                    <div key={index} className='bg-white p-6 rounded-lg shadow-md'>
                      <h3 className='text-xl font-semibold text-gray-800 mb-2'>President Email</h3>
                      <p className='text-sm text-gray-600 mb-2'>Email: {email}</p>
                      <p className='text-sm text-gray-600 mb-2'>Role: president</p>
                      <p className='text-sm text-gray-600'>Username: N/A</p>
                    </div>
                  ))}
                  {users.filter(user => user.role === 'president').length > 0 && users.filter(user => user.role === 'president').map((user) => (
                    <div key={user._id} className='bg-white p-6 rounded-lg shadow-md relative'>
                      <button
                        onClick={() => handleDeleteUser(user._id)}
                        className='absolute top-2 right-2 text-red-500 hover:text-red-700 transition-colors'
                        title='Delete user'
                      >
                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                          <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
                        </svg>
                      </button>
                      <h3 className='text-xl font-semibold text-gray-800 mb-2'>{user.name}</h3>
                      <p className='text-sm text-gray-600 mb-2'>Email: {user.email}</p>
                      <p className='text-sm text-gray-600 mb-2'>Role: {user.role}</p>
                      <p className='text-sm text-gray-600'>Username: {user.username || 'N/A'}</p>
                    </div>
                  ))}
                  {presidentEmails.length === 0 && users.filter(user => user.role === 'president').length === 0 && (
                    <p className='text-center text-gray-500'>No presidents available.</p>
                  )}
                </div>
              </div>

              {/* Admins Section */}
              <div>
                <h2 className='text-2xl font-bold mb-4 text-blue-950'>Admins</h2>
                <div className='grid grid-cols-1 gap-6'>
                  {users.filter(user => user.role === 'admin').length > 0 ? (
                    users.filter(user => user.role === 'admin').map((user) => (
                      <div key={user._id} className='bg-white p-6 rounded-lg shadow-md relative'>
                        <button
                          onClick={() => handleDeleteUser(user._id)}
                          className='absolute top-2 right-2 text-red-500 hover:text-red-700 transition-colors'
                          title='Delete user'
                        >
                          <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
                          </svg>
                        </button>
                        <h3 className='text-xl font-semibold text-gray-800 mb-2'>{user.name}</h3>
                        <p className='text-sm text-gray-600 mb-2'>Email: {user.email}</p>
                        <p className='text-sm text-gray-600 mb-2'>Role: {user.role}</p>
                        <p className='text-sm text-gray-600'>Username: {user.username || 'N/A'}</p>
                      </div>
                    ))
                  ) : (
                    <p className='text-center text-gray-500'>No admins available.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ManageUsers;
