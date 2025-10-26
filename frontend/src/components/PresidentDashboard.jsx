import React from 'react';
import PresidentUpload from './PresidentUpload';

function PresidentDashboard() {
  return (
    <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>President Dashboard</h2>
      <p>Welcome to the President's Dashboard. You can upload important documents for all users below.</p>
      <PresidentUpload />
      {/* Add more dashboard features here as needed */}
    </div>
  );
}

export default PresidentDashboard;