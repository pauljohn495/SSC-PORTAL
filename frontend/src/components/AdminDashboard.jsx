import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Automatically redirect to admin handbook
    navigate('/admin-handbook');
  }, [navigate]);

  if (!user || user.role !== 'admin') {
    return <div>Access Denied</div>;
  }

  return (
    <div className='flex items-center justify-center min-h-screen'>
      <p>Redirecting...</p>
    </div>
  );
};

export default AdminDashboard;
