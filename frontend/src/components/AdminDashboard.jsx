import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminDashboard = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  if (!user || user.role !== 'admin') {
    return <div>Access Denied</div>;
  }

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className='bg-white min-h-screen'>
      {/* Header */}
      <header className='bg-blue-950 text-white p-4 flex justify-between items-center' style={{ height: '64px' }}>
        <div className='flex items-center space-x-4' style={{ height: '100%' }}>
          <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" style={{ maxHeight: '128px', width: 'auto' }} />
          <img src="/src/assets/ssc-logo.png" alt="SSC Logo" style={{ maxHeight: '128px', width: 'auto' }} />
          <div className='flex flex-col justify-center' style={{ height: '100%' }}>
            <span className='text-lg font-bold leading-none'>BUKIDNON STATE UNIVERSITY</span>
            <span className='text-sm font-semibold leading-none pt-2'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <button
          className='text-white hover:bg-blue-900 p-2 rounded-lg transition cursor-pointer'
          onClick={toggleMenu}
          aria-label="Menu"
        >
          <div className='w-6 h-0.5 bg-white mb-1'></div>
          <div className='w-6 h-0.5 bg-white mb-1'></div>
          <div className='w-6 h-0.5 bg-white'></div>
        </button>
      </header>

      {/* Menu (if open) */}
      {menuOpen && (
        <div className='bg-blue-900 text-white p-4 absolute right-0 top-16 w-48 shadow-lg'>
          <ul>
            <li className='py-2'><Link to="/" className="hover:underline">Home</Link></li>
            <li className='py-2'><Link to="/student-handbook" className="hover:underline">Handbook</Link></li>
            <li className='py-2'><Link to="/memorandum" className="hover:underline">Memorandum</Link></li>
            <li className='py-2'><button onClick={handleLogout} className="hover:underline text-left w-full">Logout</button></li>
          </ul>
        </div>
      )}

      {/* Main Content */}
      <main className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 text-center">Admin Dashboard</h1>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
