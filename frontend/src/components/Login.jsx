import React, { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google';
import {jwtDecode} from 'jwt-decode';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ReCAPTCHA from 'react-google-recaptcha';
import bgimage from '../assets/bg-image.jpg'
import buksunew from '../assets/buksu-new.png'

function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

const handleLoginsuccess = async (credentialResponse) => {

  if (!recaptchaToken) {
    alert('Please complete the reCAPTCHA');
    return;
  }

  const userObject = jwtDecode(credentialResponse.credential);

  console.log(userObject);

  const response = await fetch('http://localhost:5001/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      googleId: userObject.sub,
      name: userObject.name,
      email: userObject.email,
      picture: userObject.picture,
      recaptchaToken
    })
  });

  const data = await response.json();
  console.log('Server response: ', data);

  if (!response.ok) {
    alert(data.message || 'Login failed');
    return;
  }

  // Store user in context and localStorage
  login(data.user);

  // Redirect to home after login
  navigate('/');
}

const handleAdminLogin = async (e) => {
  e.preventDefault();

  if (!recaptchaToken) {
    alert('Please complete the reCAPTCHA');
    return;
  }

  const response = await fetch('http://localhost:5001/api/auth/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, recaptchaToken })
  });

  const data = await response.json();
  console.log('Admin login response: ', data);

  if (!response.ok) {
    alert(data.message || 'Admin login failed');
    return;
  }

  // Store user in context and localStorage
  login(data.user);

  // Redirect to home after login
  navigate('/');
}

const handleForgotPassword = async (e) => {
  e.preventDefault();

  const response = await fetch('http://localhost:5001/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: forgotEmail })
  });

  const data = await response.json();

  if (response.ok) {
    alert('Password reset email sent!');
    setShowForgotPassword(false);
  } else {
    alert(data.message || 'Failed to send reset email');
  }
}



  return (
    <div className="flex-1 flex items-center justify-center relative h-screen" style={{ backgroundImage:
           `url(${bgimage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className='absolute inset-0 bg-black/50'></div>

<div className="card bg-white w-full max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl shadow-sm justify-center items-center">
  <figure className="px-10 pt-10">
    <img
      src={buksunew}
      alt="Logo"
      className="rounded-xl" />
  </figure> 
  <div className="card-body items-center text-center">
    <h2 className="card-title font-bold text-black">Login / Signup</h2>
    <div className="card-actions mt-3 flex flex-col items-center">

    <GoogleLogin
      onSuccess={handleLoginsuccess}
      onError={() => {
        console.log('Login Failed');
      }}
    />


    <form onSubmit={handleAdminLogin} className="w-full max-w-xs md:max-w-sm">
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
        />
      </div>
      <div className="form-control">
        <label className="label">
          <span className="label-text">Password</span>
        </label>
        <input
          type="password"
          placeholder="Enter password"
          className="input input-bordered"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="form-control mt-4">
        <button type="submit" className="btn btn-primary">Admin Login</button>
      </div>
      <div className="form-control mt-2">
        <button type="button" className="btn btn-link" onClick={() => setShowForgotPassword(true)}>Forgot Password?</button>
      </div>
    </form>

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

    <ReCAPTCHA
      sitekey="6LfhiPQrAAAAAKVfzm4gwiD-_VEDNdz4h53mIvRT" // Test key
      onChange={(token) => setRecaptchaToken(token)}
    />

      </div>
  </div>
</div>
</div>

  )
}

export default Login