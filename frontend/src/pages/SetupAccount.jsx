import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

function SetupAccount() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
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
      setMessage('Invalid setup link. Please contact the administrator.');
      return;
    }

    if (!username) {
      setMessage('Username is required');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long');
      return;
    }

    const response = await fetch('http://localhost:5001/api/auth/setup-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, username, password, name: name || undefined })
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
      setMessage('Account setup completed successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setMessage(data.message || 'Failed to setup account');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="card w-96 bg-black shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Setup Admin Account</h2>
          <p className="text-sm text-gray-400 mb-4">Complete your account setup by creating a username and password.</p>
          <form onSubmit={handleSubmit}>
            {!token && (
              <div className="alert alert-warning mb-4">
                <span>Invalid setup link. Please contact the administrator.</span>
              </div>
            )}
            <div className="form-control">
              <label className="label">
                <span className="label-text">Full Name (Optional)</span>
              </label>
              <input
                type="text"
                placeholder="Enter your full name"
                className="input input-bordered"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!token}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Username</span>
              </label>
              <input
                type="text"
                placeholder="Enter username"
                className="input input-bordered"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={!token}
              />
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                placeholder="Enter password (min 6 characters)"
                className="input input-bordered"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                placeholder="Confirm password"
                className="input input-bordered"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={!token}
              />
            </div>
            <div className="form-control mt-4">
              <button type="submit" className="btn btn-primary" disabled={!token}>
                Complete Setup
              </button>
            </div>
          </form>
          {message && <p className="text-center mt-4">{message}</p>}
        </div>
      </div>
    </div>
  );
}

export default SetupAccount;

