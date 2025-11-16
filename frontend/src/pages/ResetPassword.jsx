import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Get token from URL parameters
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!token) {
      setMessage('Invalid reset link. Please request a new password reset.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setMessage('Password must be at least 6 characters long');
      return;
    }

    const response = await fetch('http://localhost:5001/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword })
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
      setMessage('Password reset successfully! Redirecting to login...');
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
            {!token && (
              <div className="alert alert-warning mb-4">
                <span>Invalid reset link. Please request a new password reset.</span>
              </div>
            )}
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
                disabled={!token}
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
                disabled={!token}
              />
            </div>
            <div className="form-control mt-4">
              <button type="submit" className="btn btn-primary" disabled={!token}>
                Reset Password
              </button>
            </div>
          </form>
          {message && <p className="text-center mt-4">{message}</p>}
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
