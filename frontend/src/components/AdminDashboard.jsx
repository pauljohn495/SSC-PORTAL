import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminDashboard = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  if (!user || user.role !== 'admin') {
    return <div>Access Denied</div>;
  }

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
          <li><Link to="/admin-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className='text-3xl font-bold mb-8 text-blue-950'>Admin Dashboard</h1>



          {/* Quick Actions */}
          <div className='mt-8 bg-white p-6 rounded-lg shadow-md'>
            <h2 className='text-xl font-semibold mb-4 text-gray-800'>Quick Actions</h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <Link
                to="/admin-handbook"
                className='bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors text-center'
              >
                <div className='text-lg font-semibold'>Manage Handbook</div>
                <div className='text-sm'>Approve/Reject Drafts</div>
              </Link>
              <Link
                to="/admin-memorandum"
                className='bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors text-center'
              >
                <div className='text-lg font-semibold'>Manage Memorandum</div>
                <div className='text-sm'>Approve/Reject Drafts</div>
              </Link>
              <Link
                to="/manage-users"
                className='bg-purple-600 text-white p-4 rounded-lg hover:bg-purple-700 transition-colors text-center'
              >
                <div className='text-lg font-semibold'>Manage Users</div>
                <div className='text-sm'>View All Users</div>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
