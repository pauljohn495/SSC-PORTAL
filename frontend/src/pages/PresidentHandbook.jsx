import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { logApiResponse } from '../utils/fetchWithLogging';
import Swal from 'sweetalert2';

const PresidentHandbook = () => {
  const { logout, user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [handbooks, setHandbooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingHandbook, setEditingHandbook] = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [editVersion, setEditVersion] = useState(1);
  const [hasPriority, setHasPriority] = useState(false);
  const [priorityError, setPriorityError] = useState('');
  const [driveConnected, setDriveConnected] = useState(() => Boolean(user?.googleDriveConnected));
  const [checkingDrive, setCheckingDrive] = useState(true);
  const fileInputRef = useRef(null);
  const [sidebarSections, setSidebarSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [sectionSubmitting, setSectionSubmitting] = useState(false);
  const [sectionsRefreshing, setSectionsRefreshing] = useState(false);
  const [sectionForm, setSectionForm] = useState({
    title: '',
    description: '',
    order: 0,
    published: true
  });
  const [sectionFile, setSectionFile] = useState(null);
  const [sectionMessage, setSectionMessage] = useState('');
  const [sectionMessageType, setSectionMessageType] = useState('');
  const [editingSection, setEditingSection] = useState(null);
  const [editingSectionVersion, setEditingSectionVersion] = useState(1);

  const isAuthorized = !!user && user.role === 'president';

  const fetchHandbooks = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/handbook');
      const data = await response.json();
      // Show all handbooks created by any president
      setHandbooks(data);
    } catch (error) {
      console.error('Error fetching handbooks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSections = useCallback(async ({ showFullLoader = false } = {}) => {
    try {
      if (showFullLoader) {
        setSectionsLoading(true);
      } else {
        setSectionsRefreshing(true);
      }
      const response = await fetch('/api/president/handbook-sections');
      if (!response.ok) {
        throw new Error('Failed to load sidebar sections');
      }
      const data = await response.json();
      setSidebarSections(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching sidebar sections:', error);
      setSidebarSections([]);
    } finally {
      setSectionsLoading(false);
      setSectionsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (typeof user?.googleDriveConnected === 'boolean') {
      setDriveConnected(user.googleDriveConnected);
    }
  }, [user?.googleDriveConnected]);

  const checkDriveConnection = useCallback(async () => {
    if (!user?._id) return;
    try {
      setCheckingDrive(true);
      const res = await fetch(`/api/president/drive/status?userId=${user._id}`);
      if (!res.ok) {
        throw new Error('Failed to verify Google Drive connection');
      }
      const data = await res.json();
      const isConnected = Boolean(data.connected);
      setDriveConnected(isConnected);
      updateUser({ googleDriveConnected: isConnected });
    } catch (error) {
      console.error('Error checking Drive connection:', error);
      setDriveConnected(false);
      updateUser({ googleDriveConnected: false });
      setMessage('Unable to verify Google Drive connection. Please try again.');
      setMessageType('error');
    } finally {
      setCheckingDrive(false);
    }
  }, [updateUser, user?._id]);

  useEffect(() => {
    if (isAuthorized) {
      fetchHandbooks();
      fetchSections({ showFullLoader: true });
      checkDriveConnection();
      // Listen for OAuth callback
      const handleMessage = (event) => {
        if (event.data === 'google-drive-connected') {
          setMessage('Google Drive connected successfully.');
          setMessageType('success');
          checkDriveConnection();
        }
      };
      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }
  }, [isAuthorized, user?._id, checkDriveConnection, fetchHandbooks, fetchSections]);

  const connectGoogleDrive = async () => {
    if (!user?._id) return;
    try {
      const res = await fetch(`/api/president/drive/auth-url?userId=${user._id}`);
      logApiResponse(res);
      if (res.ok) {
        const { url } = await res.json();
        const popup = window.open(url, '_blank', 'width=500,height=700');
        
        // Poll for popup closure and reload page to refresh user data
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            // Wait a bit for the callback to complete, then verify status
            setTimeout(() => {
              checkDriveConnection();
            }, 1500);
          }
        }, 500);
      } else {
        const data = await res.json();
        setMessage(data.message || 'Failed to get Google Drive authorization URL');
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error connecting Google Drive:', error);
      setMessage('Error connecting Google Drive. Please try again.');
      setMessageType('error');
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (editingHandbook) {
      setEditFile(selectedFile);
    } else {
      setFile(selectedFile);
    }
  };

  const handleSectionInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setSectionForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSectionFileChange = (event) => {
    const file = event.target.files[0];
    setSectionFile(file || null);
  };

  const openSectionModal = (section = null) => {
    if (!section && !driveConnected) {
      setSectionMessage('Please connect your Google Drive account before creating sections.');
      setSectionMessageType('error');
      return;
    }
    if (section) {
      setEditingSection(section);
      setSectionForm({
        title: section.title || '',
        description: section.description || '',
        order: section.order ?? 0,
        published: section.published ?? true,
      });
      setEditingSectionVersion(section.version || 1);
    } else {
      setEditingSection(null);
      setEditingSectionVersion(1);
      setSectionForm({
        title: '',
        description: '',
        order: sidebarSections.length,
        published: true,
      });
    }
    setSectionFile(null);
    setSectionMessage('');
    setSectionMessageType('');
    setSectionModalOpen(true);
  };

  const closeSectionModal = () => {
    setSectionModalOpen(false);
    setSectionFile(null);
    setSectionMessage('');
    setSectionMessageType('');
    setEditingSection(null);
    setSectionForm({
      title: '',
      description: '',
      order: 0,
      published: true,
    });
  };

  const handleSectionSubmit = async (event) => {
    event.preventDefault();
    if (!user?._id) return;
    if (!sectionForm.title.trim()) {
      setSectionMessage('Please provide a section title.');
      setSectionMessageType('error');
      return;
    }
    if (!editingSection && !sectionFile) {
      setSectionMessage('Please upload a PDF file for this section.');
      setSectionMessageType('error');
      return;
    }
    if ((!editingSection || sectionFile) && !driveConnected) {
      setSectionMessage('Connect Google Drive to upload section PDFs.');
      setSectionMessageType('error');
      return;
    }
    try {
      setSectionSubmitting(true);
      const payload = {
        userId: user._id,
        title: sectionForm.title.trim(),
        description: sectionForm.description,
        order: Number(sectionForm.order) || 0,
        published: Boolean(sectionForm.published),
      };
      if (sectionFile) {
        payload.fileUrl = await fileToBase64(sectionFile);
        payload.fileName = sectionFile.name || `${sectionForm.title}.pdf`;
      }
      const endpoint = editingSection
        ? `/api/president/handbook-sections/${editingSection._id}`
        : '/api/president/handbook-sections';
      const method = editingSection ? 'PUT' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          ...(editingSection ? { version: editingSectionVersion } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save section');
      }
      setSectionMessage(editingSection ? 'Section update submitted for admin approval.' : 'Section submitted for admin approval.');
      setSectionMessageType('success');
      setSectionModalOpen(false);
      await fetchSections();
    } catch (error) {
      console.error('Error saving section:', error);
      setSectionMessage(error.message || 'Failed to save section.');
      setSectionMessageType('error');
    } finally {
      setSectionSubmitting(false);
      setSectionFile(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if Google Drive is connected
    if (!driveConnected) {
      setMessage('Please connect your Google Drive account first to upload handbooks.');
      setMessageType('error');
      return;
    }
    
    if (!file) {
      setMessage('Please select a PDF file to upload.');
      setMessageType('error');
      return;
    }

    if (file.type !== 'application/pdf') {
      setMessage('Please upload a PDF file.');
      setMessageType('error');
      return;
    }

    // Check file size (limit to 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      setMessage('File size is too large. Please upload a file smaller than 100MB.');
      setMessageType('error');
      return;
    }

    try {
      setSubmitting(true);
      
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        try {
          const base64File = reader.result;
          
          if (!base64File) {
            throw new Error('Failed to read file');
          }
          
          const response = await fetch('/api/president/handbook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileUrl: base64File,
              fileName: file.name || '',
              userId: user._id
            })
          });

          logApiResponse(response);
          const data = await response.json();
          
          if (response.ok) {
            setMessage('Handbook page created successfully! Waiting for admin approval.');
            setMessageType('success');
            setFile(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            setShowModal(false);
            fetchHandbooks(); // Refresh the list
          } else {
            setMessage(data.message || 'Failed to create handbook page. Please try again.');
            setMessageType('error');
          }
        } catch (error) {
          console.error('Error creating handbook page:', error);
          setMessage('Error creating handbook page. Please try again.');
          setMessageType('error');
        } finally {
          setSubmitting(false);
        }
      };

      reader.onerror = () => {
        setMessage('Error reading file. Please try again.');
        setMessageType('error');
        setSubmitting(false);
      };
    } catch (error) {
      console.error('Error creating handbook page:', error);
      setMessage('Error creating handbook page. Please try again.');
      setMessageType('error');
      setSubmitting(false);
    }
  };

  const handleEdit = async (handbook) => {
    try {
      // Try to get edit priority
      const priorityResponse = await fetch(`/api/president/handbook/${handbook._id}/priority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user._id })
      });

      logApiResponse(priorityResponse);
      const priorityData = await priorityResponse.json();

      if (priorityData.hasPriority) {
        // User has priority
        setHasPriority(true);
        setPriorityError('');
        setEditingHandbook(handbook);
        setEditFile(null);
        setEditVersion(handbook.version || 1);
        setShowModal(true);
        setFile(null);
        setMessage('');
        setMessageType('');
      } else {
        // Another user already has edit priority - do NOT open the editor.
        setHasPriority(false);
        setPriorityError('Someone is editing this right now. Please try again later.');
      }
    } catch (error) {
      console.error('Error getting edit priority:', error);
      setPriorityError('Failed to get edit priority. Please try again.');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    // If no new file is selected, use the existing file
    if (!editFile) {
      setMessage('Please select a PDF file to upload.');
      setMessageType('error');
      return;
    }

    if (editFile.type !== 'application/pdf') {
      setMessage('Please upload a PDF file.');
      setMessageType('error');
      return;
    }

    // Check file size (limit to 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (editFile.size > maxSize) {
      setMessage('File size is too large. Please upload a file smaller than 100MB.');
      setMessageType('error');
      return;
    }

    try {
      setSubmitting(true);
      
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(editFile);
      
      reader.onload = async () => {
        try {
          const base64File = reader.result;
          
          if (!base64File) {
            throw new Error('Failed to read file');
          }
          
          const response = await fetch(`/api/president/handbook/${editingHandbook._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileUrl: base64File,
              fileName: editFile.name || '',
              userId: user._id,
              version: editVersion
            })
          });

          logApiResponse(response);
          const data = await response.json();
          
          if (response.ok) {
            setMessage('Handbook page updated successfully! Waiting for admin approval.');
            setMessageType('success');
            setEditingHandbook(null);
            setEditFile(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            setShowModal(false);
            fetchHandbooks(); // Refresh the list
          } else {
            setMessage(data.message || 'Failed to update handbook page. Please try again.');
            setMessageType('error');
          }
        } catch (error) {
          console.error('Error updating handbook page:', error);
          setMessage('Error updating handbook page. Please try again.');
          setMessageType('error');
        } finally {
          setSubmitting(false);
        }
      };

      reader.onerror = () => {
        setMessage('Error reading file. Please try again.');
        setMessageType('error');
        setSubmitting(false);
      };
    } catch (error) {
      console.error('Error updating handbook page:', error);
      setMessage('Error updating handbook page. Please try again.');
      setMessageType('error');
      setSubmitting(false);
    }
  };

  const closeModal = async () => {
    // Clear priority if we have it
    if (hasPriority && editingHandbook) {
      try {
        const clearResponse = await fetch(`/api/president/handbook/${editingHandbook._id}/clear-priority`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user._id })
        });
        logApiResponse(clearResponse);
      } catch (error) {
        console.error('Error clearing priority:', error);
      }
    }

    setShowModal(false);
    setEditingHandbook(null);
    setFile(null);
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

  const isInitialSectionsLoad = sectionsLoading && sidebarSections.length === 0;

  return (
    <div className='bg-white min-h-screen flex'>
      {/* Sidebar Panel */}
      <aside className='bg-blue-950 text-white w-64 min-h-screen p-4'>
        <div className='mb-8'>
          <div className='flex items-center justify-center space-x-4 mb-4'>
            <Link to="/" className='flex items-center space-x-4'>
              <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-20 h-auto' />
              <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='w-20 h-auto' />
            </Link>
          </div>
          <div className='text-center'>
            <span className='text-sm font-bold leading-none'>BUKIDNON STATE UNIVERSITY  </span> 
            <br />
            <span className='text-xs font-semibold leading-none'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <ul className='space-y-4'>
          <li><Link to="/president-handbook" className="block py-2 px-4 bg-blue-800 rounded transition">Handbook</Link></li>
          <li><Link to="/president-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/president-policy" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Policy</Link></li>
          <li><Link to="/president-calendar" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Calendar</Link></li>
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
          <>
          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8'>
            <div>
              <h1 className='text-3xl font-bold text-blue-950'>Handbook Section</h1>
              <p className='text-sm text-gray-600'>Upload PDF sections for the student handbook. Admin approval is required before students can see them.</p>
            </div>
            <div className='flex items-center flex-wrap gap-3'>
              {!checkingDrive && !driveConnected && (
                <button
                  onClick={connectGoogleDrive}
                  className='flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors'
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Connect Google Drive</span>
                </button>
              )}
              <button 
                onClick={() => fetchSections({ showFullLoader: true })} 
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition flex items-center space-x-2"
                title="Refresh sections"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
              <button
                onClick={() => openSectionModal(null)}
                disabled={!driveConnected}
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  driveConnected
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-400 cursor-not-allowed text-white'
                }`}
              >
                Add Section
              </button>
            </div>
          </div>

          {!showModal && priorityError && !hasPriority && (
            <div className='mb-4 p-4 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200'>
              {priorityError}
            </div>
          )}

          {/* Drive Connection Warning */}
          {!checkingDrive && !driveConnected && (
            <div className='mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg'>
              <div className='flex items-start space-x-3'>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className='flex-1'>
                  <p className='text-sm font-medium text-yellow-800'>
                    Google Drive Not Connected
                  </p>
                  <p className='text-sm text-yellow-700 mt-1'>
                    You need to connect your Google Drive account to upload handbooks. Click "Connect Google Drive" above to get started.
                  </p>
                </div>
              </div>
            </div>
          )}

          {false && (
            <div className='bg-white rounded-lg shadow-md mb-8'>
              {loading ? (
                <div className='text-center py-12 text-gray-500'>Loading...</div>
              ) : handbooks.length > 0 ? (
                <div>
                  {handbooks.map((handbook, index) => {
                    const createdAt = new Date(handbook.createdAt).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    });
                    const timeAgo = getTimeAgo(handbook.createdAt);
                    
                    return (
                      <div key={handbook._id} className={`flex items-center border-b border-gray-200 hover:bg-gray-50 ${index === 0 ? 'rounded-t-lg' : ''} ${index === handbooks.length - 1 ? 'rounded-b-lg border-b-0' : ''}`}>
                        <div className='flex-1 px-6 py-4'>
                          <div className='flex items-center space-x-2'>
                            <p className='text-gray-800 font-medium'>{handbook.fileName || 'Handbook PDF'}</p>
                            {handbook.editedBy && (
                              <span className='px-2 py-1 bg-blue-900 text-white text-xs rounded-full'>
                                Edited
                              </span>
                            )}
                          </div>
                          <p className='text-sm text-gray-500 mt-1'>Full Student Handbook</p>
                          <p className='text-xs text-gray-400 mt-1'>Created by: {handbook.createdBy ? handbook.createdBy.name : 'Unknown'}</p>
                          {handbook.editedBy && (
                            <p className='text-xs text-gray-400 mt-1'>
                              Last edited: {new Date(handbook.editedAt).toLocaleString()}
                            </p>
                          )}
                          {handbook.priorityEditor && handbook.priorityEditStartedAt && (
                            <p className='text-xs text-gray-500 mt-1'>
                              Clicked Edit at: {new Date(handbook.priorityEditStartedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className='w-32 px-6 py-4 text-sm text-gray-600'>{timeAgo}</div>
                        <div className='w-28 px-6 py-4 text-sm text-gray-600'>{createdAt}</div>
                        <div className='w-32 px-6 py-4'>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(handbook.status)}`}>
                            {handbook.status}
                          </span>
                        </div>
                        <div className='w-20 px-6 py-4 flex items-center justify-end'>
                          <button
                            onClick={() => handleEdit(handbook)}
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
                <div className='text-center py-12 text-gray-500'>No handbook yet. Click "Create Handbook" to upload the full student handbook.</div>
              )}
            </div>
          )}

          <div className='bg-white rounded-lg shadow-md mb-8'>
            <div className='flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-gray-200'>
              <div>
                <h2 className='text-xl font-bold text-blue-950'>Handbook Section</h2>
                <p className='text-sm text-gray-500'>Manage the uploaded PDF sections. Each submission must be approved by an admin.</p>
              </div>
              <div className='flex items-center gap-3'>
                {!sectionsLoading && sectionsRefreshing && (
                  <span className='text-xs font-semibold text-gray-400'>Refreshing…</span>
                )}
                <button
                  onClick={() => openSectionModal(null)}
                  disabled={!driveConnected}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    driveConnected ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-400 text-white cursor-not-allowed'
                  }`}
                >
                  Add Section
                </button>
              </div>
            </div>
            {sectionMessage && (
              <div className={`mx-6 my-4 px-4 py-3 rounded-lg ${sectionMessageType === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {sectionMessage}
              </div>
            )}
            {isInitialSectionsLoad ? (
              <div className='text-center py-12 text-gray-500'>Loading sections...</div>
            ) : sidebarSections.length === 0 ? (
              <div className='text-center py-12 text-gray-500'>No sections yet. Click "Add Section" to create one.</div>
            ) : (
              <div className='relative'>
                {sectionsRefreshing && (
                  <div className='absolute inset-0 bg-white/70 backdrop-blur-[1px] flex items-center justify-center text-sm text-gray-500 rounded-b-lg z-10'>
                    Updating sections…
                  </div>
                )}
                <div className={sectionsRefreshing ? 'pointer-events-none opacity-50' : ''}>
                  {sidebarSections.map((section, index) => (
                    <div
                      key={section._id}
                      className={`flex flex-col md:flex-row md:items-center border-b border-gray-200 px-6 py-4 gap-4 ${
                        index === sidebarSections.length - 1 ? 'border-b-0 rounded-b-lg' : ''
                      }`}
                    >
                      <div className='flex-1'>
                        <div className='flex flex-wrap items-center gap-2 mb-1'>
                          <h3 className='text-lg font-semibold text-gray-800'>{section.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            section.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : section.status === 'rejected'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {section.status === 'approved' ? 'Approved' : section.status === 'rejected' ? 'Rejected' : 'Pending Approval'}
                          </span>
                        </div>
                        {section.description && (
                          <p className='text-sm text-gray-600'>{section.description}</p>
                        )}
                        <p className='text-xs text-gray-400 mt-1'>Order: {section.order ?? 0}</p>
                        {section.status !== 'approved' && (
                          <p className='text-xs text-orange-600 mt-1'>Waiting for admin approval before publishing.</p>
                        )}
                        {section.status === 'rejected' && (
                          <p className='text-xs text-red-600 mt-1'>Rejected by admin. Please upload a revised PDF.</p>
                        )}
                      </div>
                      <div className='flex items-center gap-2'>
                        <button
                          onClick={() => openSectionModal(section)}
                          className='px-4 py-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors'
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          </>
          )}
        </div>
      </main>

      {/* Modal */}
      {showModal && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <h2 className='text-2xl font-bold mb-6 text-blue-950'>
              {editingHandbook ? 'Edit Handbook' : 'Create Handbook'}
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

            <form onSubmit={editingHandbook ? handleUpdate : handleSubmit}>
              {editingHandbook && (
                <div className='mb-4 p-3 bg-blue-50 rounded-lg'>
                  <p className='text-sm text-blue-800'>
                    <strong>Current File:</strong> {editingHandbook.fileName || 'handbook.pdf'}
                  </p>
                </div>
              )}

              <div className='mb-6'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>
                  PDF File
                </label>
                {editingHandbook && editingHandbook.fileName && !editFile && (
                  <div className='mb-3 p-3 bg-gray-50 rounded-lg'>
                    <p className='text-sm text-gray-600'>Current file: <span className='font-medium'>{editingHandbook.fileName}</span></p>
                  </div>
                )}
                <input
                  type='file'
                  accept='application/pdf'
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-black'
                  required={!editingHandbook || !editingHandbook.fileUrl}
                />
                <p className='text-xs text-gray-500 mt-2'>Please upload a PDF file (max 100MB)</p>
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
                  disabled={submitting || (editingHandbook && !hasPriority)}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                    submitting || (editingHandbook && !hasPriority)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {submitting ? (editingHandbook ? 'Updating...' : 'Creating...') : 
                   editingHandbook && !hasPriority ? 'No Save Priority' :
                   editingHandbook ? 'Update Handbook' : 'Create Handbook'}
                </button>
                <button
                  type='button'
                  onClick={closeModal}
                  disabled={submitting}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    submitting
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

      {sectionModalOpen && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
            <h2 className='text-2xl font-bold mb-6 text-blue-950'>
              {editingSection ? 'Edit Sidebar Section' : 'Add Sidebar Section'}
            </h2>
            {sectionMessageType === 'error' && sectionMessage && (
              <div className='mb-4 p-3 rounded-lg bg-red-50 text-red-800'>
                {sectionMessage}
              </div>
            )}
            <form onSubmit={handleSectionSubmit} className='space-y-4'>
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>Title</label>
                <input
                  type='text'
                  name='title'
                  value={sectionForm.title}
                  onChange={handleSectionInputChange}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black'
                  required
                />
              </div>
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>Description</label>
                <textarea
                  name='description'
                  value={sectionForm.description}
                  onChange={handleSectionInputChange}
                  rows={3}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black'
                  placeholder='Optional description'
                />
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>Order</label>
                  <input
                    type='number'
                    name='order'
                    value={sectionForm.order}
                    onChange={handleSectionInputChange}
                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black'
                  />
                </div>
                <div className='flex items-center gap-2 mt-6 md:mt-8'>
                  <input
                    type='checkbox'
                    id='section-published'
                    name='published'
                    checked={sectionForm.published}
                    onChange={handleSectionInputChange}
                    className='h-4 w-4 text-blue-600 border-gray-300 rounded'
                  />
                  <label htmlFor='section-published' className='text-sm text-gray-700'>
                    Visible to students
                  </label>
                </div>
              </div>
              <div>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>
                  PDF File {editingSection ? '(optional)' : ''}
                </label>
                <input
                  type='file'
                  accept='application/pdf'
                  onChange={handleSectionFileChange}
                  className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 text-black'
                  required={!editingSection}
                />
                <p className='text-xs text-gray-500 mt-1'>Upload the PDF to display when students select this section.</p>
              </div>
              <div className='flex justify-end gap-3 pt-4'>
                <button
                  type='button'
                  onClick={closeSectionModal}
                  className='px-6 py-2 rounded-lg font-semibold bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors'
                  disabled={sectionSubmitting}
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={sectionSubmitting}
                  className='px-6 py-2 rounded-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {sectionSubmitting ? 'Saving...' : editingSection ? 'Update Section' : 'Create Section'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresidentHandbook;
