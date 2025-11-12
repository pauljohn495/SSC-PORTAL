import React, { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google';
import {jwtDecode} from 'jwt-decode';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import buksunew from '../assets/buksu-new.png'

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [recaptchaError, setRecaptchaError] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const recaptchaRef = React.useRef(null);

const handleLoginsuccess = async (credentialResponse) => {

  // Allow Google login even if reCAPTCHA has errors (backend will handle in dev mode)
  if (!recaptchaToken && !recaptchaError) {
    alert('Please complete the reCAPTCHA');
    return;
  }

  const userObject = jwtDecode(credentialResponse.credential);

  const response = await fetch('http://localhost:5001/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googleId: userObject.sub,
      name: userObject.name,
      email: userObject.email,
      picture: userObject.picture,
      recaptchaToken: recaptchaToken || null
    })
  });

  const data = await response.json();

  if (!response.ok) {
    // Show specific error message
    const errorMessage = data.message || 'Login failed';
    alert(errorMessage);
    return;
  }

  if (!data.user || !data.user.role) {
    alert('Invalid user data received. Please try again.');
    return;
  }

  // Store user in context and localStorage
  login(data.user);

  // Redirect to home after login
  navigate('/');
}

const handleAdminLogin = async (e) => {
  e.preventDefault();


  // Only require reCAPTCHA in production or if explicitly configured
  // In development, allow login without reCAPTCHA if it fails
  if (!recaptchaToken && !recaptchaError) {
    alert('Please complete the reCAPTCHA');
    return;
  }

  // Send recaptchaToken even if empty (backend will handle gracefully in dev mode)
  const response = await fetch('http://localhost:5001/api/auth/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, recaptchaToken: recaptchaToken || null })
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.message || 'Admin login failed');
    return;
  }

  if (!data.user || !data.user.role) {
    alert('Invalid user data received. Please try again.');
    return;
  }

  // Store user in context and localStorage
  login(data.user);

  // Redirect to home after login
  navigate('/');
}

const handleForgotPassword = async (e) => {
  e.preventDefault();

  if (!forgotEmail.trim()) {
    alert('Please enter your email address');
    return;
  }

  try {
    const response = await fetch('http://localhost:5001/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail.trim() })
    });

    const data = await response.json();

    if (response.ok) {
      alert('Password reset email sent! Please check your inbox (and spam folder).');
      setShowForgotPassword(false);
      setForgotEmail('');
    } else {
      // Show detailed error message
      let errorMsg = data.message || 'Failed to send reset email';
      if (data.error === 'EMAIL_CONFIG_MISSING') {
        errorMsg = 'Email service is not configured. Please contact the administrator.';
      } else if (data.error === 'EMAIL_TRANSPORTER_ERROR') {
        errorMsg = 'Email service error. Please contact the administrator.';
      } else if (data.error === 'EMAIL_SEND_ERROR') {
        errorMsg = data.message || 'Failed to send email. Please try again later.';
      }
      alert(errorMsg);
    }
  } catch (error) {
    console.error('Error sending forgot password request:', error);
    alert('Network error. Please check your connection and try again.');
  }
}



  return (
    <div className="min-h-screen flex">
      {/* Left Side - Logo and Welcome */}
      <div className="hidden lg:flex lg:w-1/2 bg-blue-950 text-white flex-col items-center justify-center px-12">
        <div className="flex flex-col items-center space-y-8">
          <img
            src={buksunew}
            alt="BUKSU Logo"
            className="w-64 h-auto"
          />
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold">Welcome</h1>
            <p className="text-xl text-blue-200">
              BUKIDNON STATE UNIVERSITY
            </p>
            <p className="text-lg text-blue-300">
              SUPREME STUDENT COUNCIL
            </p>
            <p className="text-base text-blue-200 mt-6 max-w-md">
              Access your SSC Portal to stay informed with the latest school updates, announcements, and access to the student handbook.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <img
              src={buksunew}
              alt="BUKSU Logo"
              className="w-48 h-auto"
            />
          </div>

          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-3xl font-bold text-blue-950 mb-2 text-center">Login</h2>
            <p className="text-gray-600 text-center mb-8">Sign in to your account</p>

            {/* Google Login */}
            <div className="mb-6">
              <GoogleLogin
                onSuccess={handleLoginsuccess}
                onError={() => {
                  console.log('Login Failed');
                }}
              />
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with</span>
              </div>
            </div>

            {/* Admin Login Form */}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  placeholder="Enter username"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter password"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot Password?
                </button>
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Admin Login
              </button>
            </form>

            {/* reCAPTCHA */}
            <div className="mt-6 flex justify-center">
              <ReCAPTCHA
                ref={recaptchaRef}
                sitekey="6LfhiPQrAAAAAKVfzm4gwiD-_VEDNdz4h53mIvRT"
                onChange={(token) => {
                  setRecaptchaToken(token);
                  setRecaptchaError(false);
                }}
                onExpired={() => {
                  setRecaptchaToken('');
                  setRecaptchaError(true);
                  console.warn('reCAPTCHA expired');
                }}
                onErrored={() => {
                  setRecaptchaError(true);
                  console.warn('reCAPTCHA error occurred - login may still work in development mode');
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-3">Forgot Password</h3>
            <form onSubmit={handleForgotPassword}>
              <div className="form-control">
                <label className="label">
                  <span className="label-text mr-3">EMAIL</span>
                </label>
                <input
                  type="email"
                  placeholder="Enter admin email"
                  className="input input-bordered"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                />
              </div>
              <div className="modal-action">
                <button type="button" className="btn" onClick={() => setShowForgotPassword(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Send Reset Email</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Login