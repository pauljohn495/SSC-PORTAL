import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PresidentDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Automatically redirect to president handbook
    navigate('/president-handbook');
  }, [navigate]);

  if (!user || user.role !== 'president') {
    return <div>Access Denied</div>;
  }

  return (
    <div className='flex items-center justify-center min-h-screen'>
      <p>Redirecting...</p>
    </div>
  );
};

export default PresidentDashboard;
