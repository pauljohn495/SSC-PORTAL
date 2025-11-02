import React, { useState, useRef, useEffect } from 'react';
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
  const [showModal, setShowModal] = useState(false);
  const [memorandums, setMemorandums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingMemorandum, setEditingMemorandum] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editYear, setEditYear] = useState('');
  const [editFile, setEditFile] = useState(null);
  const [editVersion, setEditVersion] = useState(1);
  const [hasPriority, setHasPriority] = useState(false);
  const [priorityError, setPriorityError] = useState('');
  const fileInputRef = useRef(null);

  const isAuthorized = !!user && user.role === 'president';

  useEffect(() => {
    if (isAuthorized) {
      fetchMemorandums();
    }
  }, [isAuthorized]);

  const fetchMemorandums = async () => {
    try {
      const response = await fetch('/api/admin/memorandums');
      const data = await response.json();
      // Show all memorandums created by any president
      setMemorandums(data);
    } catch (error) {
      console.error('Error fetching memorandums:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (editingMemorandum) {
      setEditFile(selectedFile);
    } else {
      setFile(selectedFile);
    }
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
        
        const response = await fetch('/api/president/memorandums', {
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
          setShowModal(false);
          fetchMemorandums(); // Refresh the list
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

  const handleEdit = async (memorandum) => {
    try {
      // Try to get edit priority
      const priorityResponse = await fetch(`/api/president/memorandums/${memorandum._id}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id })
      });

      const priorityData = await priorityResponse.json();

      if (priorityData.hasPriority) {
        // User has priority
        setHasPriority(true);
        setPriorityError('');
        setEditingMemorandum(memorandum);
        setEditTitle(memorandum.title);
        setEditYear(memorandum.year.toString());
        setEditFile(null);
        setEditVersion(memorandum.version || 1);
        setShowModal(true);
        setTitle('');
        setYear('');
        setFile(null);
        setMessage('');
        setMessageType('');
      } else {
        // Another user has priority
        setHasPriority(false);
        setPriorityError(`${priorityData.priorityEditor} has edit priority since ${new Date(priorityData.priorityEditStartedAt).toLocaleString()}. You can edit but only they can save.`);
        setEditingMemorandum(memorandum);
        setEditTitle(memorandum.title);
        setEditYear(memorandum.year.toString());
        setEditFile(null);
        setEditVersion(memorandum.version || 1);
        setShowModal(true);
        setTitle('');
        setYear('');
        setFile(null);
        setMessage('');
        setMessageType('');
      }
    } catch (error) {
      console.error('Error getting edit priority:', error);
      setPriorityError('Failed to get edit priority. Please try again.');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    if (!editTitle || !editYear) {
      setMessage('Please fill in all required fields.');
      setMessageType('error');
      return;
    }

    try {
      setUploading(true);
      
      let fileUrl;
      if (editFile) {
        // If a new file is uploaded, convert it to base64
        if (editFile.type !== 'application/pdf') {
          setMessage('Please upload a PDF file.');
          setMessageType('error');
          setUploading(false);
          return;
        }
        
        fileUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(editFile);
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
        });
      } else {
        // Use existing file URL if no new file is uploaded
        fileUrl = editingMemorandum.fileUrl;
      }
      
      const response = await fetch(`/api/president/memorandums/${editingMemorandum._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          year: parseInt(editYear),
          fileUrl: fileUrl,
          userId: user._id,
          version: editVersion
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage('Memorandum updated successfully! Waiting for admin approval.');
        setMessageType('success');
        setEditingMemorandum(null);
        setEditTitle('');
        setEditYear('');
        setEditFile(null);
        setShowModal(false);
        fetchMemorandums(); // Refresh the list
      } else {
        setMessage(data.message || 'Failed to update memorandum. Please try again.');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error updating memorandum:', error);
      setMessage('Error updating memorandum. Please try again.');
      setMessageType('error');
    } finally {
      setUploading(false);
    }
  };

  const closeModal = async () => {
    // Clear priority if we have it
    if (hasPriority && editingMemorandum) {
      try {
        await fetch(`/api/president/memorandums/${editingMemorandum._id}/clear-priority`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user._id })
        });
      } catch (error) {
        console.error('Error clearing priority:', error);
      }
    }

    setShowModal(false);
    setEditingMemorandum(null);
    setTitle('');
    setYear('');
    setFile(null);
    setEditTitle('');
    setEditYear('');
    setEditFile(null);
    setEditVersion(1);
    setHasPriority(false);
    setPriorityError('');
    setMessage('');
    setMessageType('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      case 'draft':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return `${Math.floor(diffInSeconds / 2592000)} months ago`;
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
          <li><Link to="/president-notifications" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Notifications</Link></li>
          <li><Link to="/president-activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          {!isAuthorized ? (
            <div>Access Denied</div>
          ) : (
          <div className='flex justify-between items-center mb-8'>
            <h1 className='text-3xl font-bold text-blue-950'>Memorandum</h1>
            <button
              onClick={() => setShowModal(true)}
              className='bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors'
            >
              Create Memorandum
            </button>
          </div>
          )}

          {/* Memorandum List */}
          <div className='bg-white rounded-lg shadow-md mb-8'>
            {!isAuthorized ? null : (loading ? (
              <div className='text-center py-12 text-gray-500'>Loading...</div>
            ) : memorandums.length > 0 ? (
              <div>
                {memorandums.map((memorandum, index) => {
                  const createdAt = new Date(memorandum.uploadedAt).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                  });
                  const timeAgo = getTimeAgo(memorandum.uploadedAt);
                  
                  return (
                    <div key={memorandum._id} className={`flex items-center border-b border-gray-200 hover:bg-gray-50 ${index === 0 ? 'rounded-t-lg' : ''} ${index === memorandums.length - 1 ? 'rounded-b-lg border-b-0' : ''}`}>
                      <div className='flex-1 px-6 py-4'>
                        <div className='flex items-center space-x-2'>
                          <p className='text-gray-800 font-medium'>{memorandum.title}</p>
                          {memorandum.editedBy && (
                            <span className='px-2 py-1 bg-blue-900 text-white text-xs rounded-full'>
                              Edited
                            </span>
                          )}
                        </div>
                        <p className='text-sm text-gray-500 mt-1'>Year: {memorandum.year}</p>
                        <p className='text-xs text-gray-400 mt-1'>Created by: {memorandum.createdBy ? memorandum.createdBy.name : 'Unknown'}</p>
                        {memorandum.editedBy && (
                          <p className='text-xs text-gray-400 mt-1'>
                            Last edited: {new Date(memorandum.editedAt).toLocaleString()}
                          </p>
                        )}
                        {memorandum.priorityEditor && memorandum.priorityEditStartedAt && (
                          <p className='text-xs text-gray-500 mt-1'>
                            Clicked Edit at: {new Date(memorandum.priorityEditStartedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className='w-32 px-6 py-4 text-sm text-gray-600'>{timeAgo}</div>
                      <div className='w-28 px-6 py-4 text-sm text-gray-600'>{createdAt}</div>
                      <div className='w-32 px-6 py-4'>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(memorandum.status)}`}>
                          {memorandum.status}
                        </span>
                      </div>
                      <div className='w-20 px-6 py-4 flex items-center justify-end'>
                        <button
                          onClick={() => handleEdit(memorandum)}
                          className='text-blue-600 hover:text-blue-800 transition-colors'
                          title='Edit'
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className='text-center py-12 text-gray-500'>No memorandums yet. Click "Create Memorandum" to add one.</div>
            ))}
          </div>
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <h2 className='text-2xl font-bold mb-6 text-blue-950'>
              {editingMemorandum ? 'Edit Memorandum' : 'Create Memorandum'}
            </h2>

            {priorityError && (
              <div className={`mb-6 p-4 rounded-lg ${hasPriority ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
                {priorityError}
              </div>
            )}

            {hasPriority && (
              <div className='mb-6 p-4 bg-green-50 text-green-800 rounded-lg'>
                ✅ You have edit priority - your changes will be saved
              </div>
            )}

            <form onSubmit={editingMemorandum ? handleUpdate : handleUpload}>
              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>
                  Memorandum Title
                </label>
                <input
                  type='text'
                  value={editingMemorandum ? editTitle : title}
                  onChange={(e) => editingMemorandum ? setEditTitle(e.target.value) : setTitle(e.target.value)}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  placeholder='Enter memorandum title'
                  required
                />
              </div>

              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>
                  Year
                </label>
                <input
                  type='number'
                  value={editingMemorandum ? editYear : year}
                  onChange={(e) => editingMemorandum ? setEditYear(e.target.value) : setYear(e.target.value)}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  placeholder='Enter year'
                  min='2000'
                  max='2100'
                  required
                />
              </div>

              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>
                  {editingMemorandum ? 'Replace PDF File (Optional)' : 'Upload PDF File'}
                </label>
                <input
                  ref={fileInputRef}
                  type='file'
                  onChange={handleFileChange}
                  accept='.pdf'
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  required={!editingMemorandum}
                />
                <p className='text-xs text-gray-500 mt-2'>Only PDF files are accepted</p>
                {editingMemorandum && <p className='text-xs text-gray-500 mt-1'>Leave empty to keep the current file</p>}
              </div>

              {message && (
                <div className={`mb-6 p-4 rounded-lg ${
                  messageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                }`}>
                  {message}
                </div>
              )}

              <div className='flex space-x-4'>
                <button
                  type='submit'
                  disabled={uploading || (editingMemorandum && !hasPriority)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                    uploading || (editingMemorandum && !hasPriority)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {uploading ? (editingMemorandum ? 'Updating...' : 'Creating...') : 
                   editingMemorandum && !hasPriority ? 'No Save Priority' :
                   editingMemorandum ? 'Update Memorandum' : 'Create Memorandum'}
                </button>
                <button
                  type='button'
                  onClick={closeModal}
                  disabled={uploading}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    uploading
                      ? 'bg-gray-200 cursor-not-allowed'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresidentMemorandum;

