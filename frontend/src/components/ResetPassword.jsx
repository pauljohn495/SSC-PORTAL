import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function ResetPassword() {
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    const response = await fetch('http://localhost:5001/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, newPassword })
    });

    const data = await response.json();

    if (response.ok) {
      setMessage('Password reset successfully!');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setMessage(data.message || 'Failed to reset password');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="card w-96 bg-black shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Reset Password</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Reset Code</span>
              </label>
              <input
                type="text"
                placeholder="Enter 6-digit code"
                className="input input-bordered"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">New Password</span>
              </label>
              <input
                type="password"
                placeholder="Enter new password"
                className="input input-bordered"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Confirm Password</span>
              </label>
              <input
                type="password"
                placeholder="Confirm new password"
                className="input input-bordered"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-control mt-4">
              <button type="submit" className="btn btn-primary">Reset Password</button>
            </div>
          </form>
          {message && <p className="text-center mt-4">{message}</p>}
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
