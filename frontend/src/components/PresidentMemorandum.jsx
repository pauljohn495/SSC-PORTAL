import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const PresidentMemorandum = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const fileInputRef = useRef(null);

  if (!user || user.role !== 'president') {
    return <div>Access Denied</div>;
  }

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!title || !year || !file) {
      setMessage('Please fill in all fields and select a file.');
      setMessageType('error');
      return;
    }

    if (file.type !== 'application/pdf') {
      setMessage('Please upload a PDF file.');
      setMessageType('error');
      return;
    }

    try {
      setUploading(true);
      
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64File = reader.result;
        
        const response = await fetch('http://localhost:5001/api/memorandums', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            year: parseInt(year),
            fileUrl: base64File,
            userId: user._id
          })
        });

        const data = await response.json();
        
        if (response.ok) {
          setMessage('Memorandum uploaded successfully! Waiting for admin approval.');
          setMessageType('success');
          setTitle('');
          setYear('');
          setFile(null);
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setUploading(false);
        } else {
          setMessage(data.message || 'Upload failed. Please try again.');
          setMessageType('error');
          setUploading(false);
        }
      };
      
      reader.onerror = () => {
        setMessage('Error reading file. Please try again.');
        setMessageType('error');
        setUploading(false);
      };
    } catch (error) {
      console.error('Error uploading memorandum:', error);
      setMessage('Error uploading memorandum. Please try again.');
      setMessageType('error');
      setUploading(false);
    }
  };

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
          <li><Link to="/president-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/president-memorandum" className="block py-2 px-4 bg-blue-800 rounded transition">Memorandum</Link></li>
          <li><Link to="/president-activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className='text-3xl font-bold mb-8 text-blue-950'>Upload Memorandum</h1>

          <div className='bg-white p-6 rounded-lg shadow-md'>
            <form onSubmit={handleUpload}>
              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2 text-black'>
                  Memorandum Title
                </label>
                <input
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  placeholder='Enter memorandum title'
                  required
                />
              </div>

              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2 text-black'>
                  Year
                </label>
                <input
                  type='number'
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  placeholder='Enter year'
                  min='2000'
                  max='2100'
                  required
                />
              </div>

              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2 text-black'>
                  Upload PDF File
                </label>
                <input
                  ref={fileInputRef}
                  type='file'
                  onChange={handleFileChange}
                  accept='.pdf'
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  required
                />
                <p className='text-xs text-gray-500 mt-2'>Only PDF files are accepted</p>
              </div>

              {message && (
                <div className={`mb-6 p-4 rounded-lg ${
                  messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {message}
                </div>
              )}

              <button
                type='submit'
                disabled={uploading}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  uploading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {uploading ? 'Uploading...' : 'Upload Memorandum'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PresidentMemorandum;

