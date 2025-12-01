import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { colleges } from '../data/colleges'

const PresidentPolicy = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [deptModalOpen, setDeptModalOpen] = useState(false)
  const [deptForm, setDeptForm] = useState({ name: '', description: '' })
  const [sectionModalOpen, setSectionModalOpen] = useState(false)
  const [sectionForm, setSectionForm] = useState({ departmentId: '', title: '', description: '' })
  const [sectionFile, setSectionFile] = useState(null)
  const [editingSection, setEditingSection] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [hasPriority, setHasPriority] = useState(false)
  const [priorityError, setPriorityError] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAuthorized = useMemo(() => user?.role === 'president', [user?.role])

  useEffect(() => {
    if (!user) {
      return
    }
    if (!isAuthorized) {
      navigate('/login')
      return
    }
    fetchDepartments()
  }, [user?._id, isAuthorized, navigate])

  const fetchDepartments = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/president/policies/departments')
      if (!response.ok) {
        throw new Error('Failed to load policy departments')
      }
      const data = await response.json()
      setDepartments(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching policy departments:', error)
      setDepartments([])
      setMessage(error.message || 'Failed to load policy departments')
      setMessageType('error')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    if (logout) {
      logout()
    }
    navigate('/login')
  }

  const handleSectionInput = (event) => {
    const { name, value } = event.target
    setSectionForm((prev) => ({ ...prev, [name]: value }))
  }

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const submitDepartment = async (event) => {
    event.preventDefault()
    if (!deptForm.name.trim()) {
      setMessage('Department is required')
      setMessageType('error')
      return
    }
    try {
      setMessage('')
      const response = await fetch('/api/president/policies/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: deptForm.name,
          description: deptForm.description,
          userId: user._id
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create department')
      }
      setDeptModalOpen(false)
      setDeptForm({ name: '', description: '' })
      fetchDepartments()
      setMessage('Department created successfully')
      setMessageType('success')
    } catch (error) {
      setMessage(error.message || 'Failed to create department')
      setMessageType('error')
    }
  }

  const openSectionModal = async (section = null, departmentId = null) => {
    if (section) {
      // Try to get edit priority
      try {
        const priorityResponse = await fetch(`/api/president/policies/sections/${section._id}/priority`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user._id })
        });

        let priorityData = {};
        try {
          priorityData = await priorityResponse.json();
        } catch {
          priorityData = {};
        }

        // Always open the modal
        setEditingSection(section);
        setSectionForm({
          departmentId: departmentId || '',
          title: section.title || '',
          description: section.description || ''
        });
        setSectionFile(null);
        setMessage('');
        setMessageType('');
        setSectionModalOpen(true);

        // If the request itself failed, user can still view but cannot save
        if (!priorityResponse.ok) {
          setHasPriority(false);
          setPriorityError(priorityData.message || 'Someone else is currently editing this section. You can view but cannot save changes.');
          return;
        }

        // If the server did not return a clear boolean hasPriority flag,
        // treat it as "no priority" to avoid two users editing at once.
        if (typeof priorityData.hasPriority !== 'boolean') {
          setHasPriority(false);
          setPriorityError('Unable to determine edit priority. You can view but cannot save changes.');
          return;
        }

        if (priorityData.hasPriority) {
          // User has priority
          setHasPriority(true);
          setPriorityError('');
        } else {
          // Another user already has edit priority - user can view but cannot save
          setHasPriority(false);
          setPriorityError('Someone else is currently editing this section. You can view but cannot save changes.');
        }
      } catch (error) {
        console.error('Error getting edit priority:', error);
        // Still open the modal but without save ability
        setEditingSection(section);
        setSectionForm({
          departmentId: departmentId || '',
          title: section.title || '',
          description: section.description || ''
        });
        setSectionFile(null);
        setMessage('');
        setMessageType('');
        setSectionModalOpen(true);
        setHasPriority(false);
        setPriorityError('Failed to get edit priority. You can view but cannot save changes.');
      }
    } else {
      setEditingSection(null);
      setSectionForm({ departmentId: '', title: '', description: '' });
      setSectionFile(null);
      setMessage('');
      setMessageType('');
      setHasPriority(true); // New sections always have priority
      setPriorityError('');
      setSectionModalOpen(true);
    }
  }

  const closeSectionModal = async () => {
    // Clear priority if we have it
    if (hasPriority && editingSection) {
      try {
        await fetch(`/api/president/policies/sections/${editingSection._id}/clear-priority`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user._id })
        });
      } catch (error) {
        console.error('Error clearing section priority:', error);
      }
    }

    setSectionModalOpen(false);
    setEditingSection(null);
    setSectionForm({ departmentId: '', title: '', description: '' });
    setSectionFile(null);
    setMessage('');
    setMessageType('');
    setHasPriority(false);
    setPriorityError('');
  }

  const submitSection = async (event) => {
    event.preventDefault()
    
    if (editingSection) {
      // Update existing section
      if (!sectionForm.departmentId || !sectionForm.title.trim()) {
        setMessage('Department and title are required')
        setMessageType('error')
        return
      }
      
      try {
        setSubmitting(true)
        setMessage('')
        
        const payload = {
          departmentId: sectionForm.departmentId,
          title: sectionForm.title,
          description: sectionForm.description,
          userId: user._id
        }
        
        // Only include file if a new one is uploaded
        if (sectionFile) {
          payload.fileUrl = await fileToBase64(sectionFile)
          payload.fileName = sectionFile.name
        }
        
        const response = await fetch(`/api/president/policies/sections/${editingSection._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          // If the backend says we no longer have edit priority, show "Failed to Update" and close modal
          if (response.status === 409 && (data.hasPriority === false || data.message?.includes('edit priority'))) {
            setHasPriority(false);
            setPriorityError(data.message || 'You no longer have edit priority for this document.');
            setMessage('Your changes will not be saved');
            setMessageType('error');
            // Close modal after showing error
            setTimeout(() => {
              closeSectionModal();
              fetchDepartments();
            }, 1500);
            return;
          }
          setMessage(data.message || 'Failed to update section');
          setMessageType('error');
          return;
        }
        
        closeSectionModal()
        fetchDepartments()
        setMessage('Section updated successfully. Waiting for admin approval.')
        setMessageType('success')
      } catch (error) {
        console.error('Error updating section:', error)
        setMessage(error.message || 'Failed to update section')
        setMessageType('error')
      } finally {
        setSubmitting(false)
      }
    } else {
      // Create new section
      if (!sectionForm.departmentId || !sectionForm.title.trim() || !sectionFile) {
        setMessage('Department, title, and PDF are required')
        setMessageType('error')
        return
      }
      
      try {
        setSubmitting(true)
        setMessage('')
        
        const base64 = await fileToBase64(sectionFile)
        const response = await fetch('/api/president/policies/sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            departmentId: sectionForm.departmentId,
            title: sectionForm.title,
            description: sectionForm.description,
            fileUrl: base64,
            fileName: sectionFile.name,
            userId: user._id
          })
        })
        
        const data = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(data.message || 'Failed to create section')
        }
        
        closeSectionModal()
        fetchDepartments()
        setMessage('Section submitted for approval')
        setMessageType('success')
      } catch (error) {
        console.error('Error creating section:', error)
        setMessage(error.message || 'Failed to create section')
        setMessageType('error')
      } finally {
        setSubmitting(false)
      }
    }
  }


  if (!isAuthorized) {
    return <div>Access Denied</div>
  }

  return (
    <div className='bg-white min-h-screen flex flex-col lg:flex-row'>
      {/* Mobile Header */}
      <div className='lg:hidden bg-blue-950 text-white p-4 flex justify-between items-center'>
        <div className='flex items-center space-x-2'>
          <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-12 h-auto' />
          <span className='text-sm font-bold'>BUKSU SSC</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className='text-white p-2 hover:bg-blue-900 rounded'
          aria-label="Toggle menu"
        >
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            {sidebarOpen ? (
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            ) : (
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar Panel */}
      <aside className={`bg-blue-950 text-white w-64 min-h-screen p-4 fixed lg:static inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className='mb-8'>
          <div className='flex items-center justify-center space-x-4 mb-4'>
            <Link to="/" className='flex items-center space-x-4' onClick={() => setSidebarOpen(false)}>
              <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-16 sm:w-20 h-auto' />
              <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='w-16 sm:w-20 h-auto hidden sm:block' />
            </Link>
          </div>
          <div className='text-center'>
            <span className='text-xs sm:text-sm font-bold leading-none'>BUKIDNON STATE UNIVERSITY</span>
            <br />
            <span className='text-xs font-semibold leading-none'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <ul className='space-y-4'>
          <li><Link to="/president-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Handbook</Link></li>
          <li><Link to="/president-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Memorandum</Link></li>
          <li><Link to="/president-policy" className="block py-2 px-4 bg-blue-800 rounded transition" onClick={() => setSidebarOpen(false)}>Policy</Link></li>
          <li><Link to="/president-calendar" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Calendar</Link></li>
          <li><Link to="/president-notifications" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Notifications</Link></li>
          <li><Link to="/president-activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Activity Logs</Link></li>
          <li><button onClick={() => { handleLogout(); setSidebarOpen(false); }} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className='fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 bg-gray-100 p-4 sm:p-6 md:p-8">
        <div className='max-w-6xl mx-auto space-y-4 sm:space-y-6'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
            <div>
              <h1 className='text-2xl sm:text-3xl font-bold text-blue-950'>Policy Management</h1>
              <p className='text-sm sm:text-base text-gray-600'>Organize Colleges and course-specific policies.</p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <button
                onClick={() => setDeptModalOpen(true)}
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold min-h-[44px]'
              >
                Create College
              </button>
              <button
                onClick={() => openSectionModal(null)}
                className='px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition text-sm font-semibold min-h-[44px]'
              >
                Create Section
              </button>
            </div>
          </div>

          {message && (
            <div className={`rounded-lg px-4 py-3 text-sm ${messageType === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
              {message}
            </div>
          )}

          {loading ? (
            <div className='text-center text-gray-500 py-12'>Loading College...</div>
          ) : departments.length === 0 ? (
            <div className='text-center text-gray-500 py-12 bg-white rounded-lg shadow'>No College yet.</div>
          ) : (
            <div className='space-y-6'>
              {departments.map((department) => (
                <div key={department._id} className='bg-white rounded-lg shadow border border-gray-200'>
                  <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-gray-100 p-4'>
                    <div>
                      <h2 className='text-xl font-semibold text-blue-950'>{department.name}</h2>
                      {department.description && (
                        <p className='text-sm text-gray-600 mt-1'>{department.description}</p>
                      )}
                    </div>
                  </div>
                  <div className='p-4 space-y-3'>
                    {department.sections && department.sections.length > 0 ? (
                      department.sections.map((section) => (
                        <div key={section._id} className='border border-gray-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
                          <div className='flex-1'>
                            <p className='font-semibold text-gray-800'>{section.title}</p>
                            {section.description && (
                              <p className='text-sm text-gray-600'>{section.description}</p>
                            )}
                            {section.updatedBy && section.updatedAt && (
                              <p className='text-xs text-gray-400 mt-1'>
                                Last edited: {new Date(section.updatedAt).toLocaleString()}
                                {section.updatedBy.name && ` by ${section.updatedBy.name}`}
                              </p>
                            )}
                          </div>
                          <div className='flex items-center gap-2'>
                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                              section.status === 'approved'
                                ? 'bg-green-100 text-green-700'
                                : section.status === 'rejected'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {section.status.toUpperCase()}
                            </span>
                            <button
                              onClick={() => openSectionModal(section, department._id)}
                              className='text-blue-600 hover:text-blue-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center'
                              title='Edit'
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className='text-sm text-gray-500'>No sections for this College.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {deptModalOpen && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white text-black rounded-lg shadow-xl w-full max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto'>
            <h3 className='text-xl font-semibold text-blue-950 mb-4'>Create College</h3>
            <form className='space-y-4' onSubmit={submitDepartment}>
              <div>
                <label className='text-sm font-semibold text-black block mb-1'>College</label>
                <select
                  name='name'
                  value={deptForm.name}
                  onChange={(event) => setDeptForm((prev) => ({ ...prev, name: event.target.value }))}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
                  required
                >
                  <option value="">Select College</option>
                  {colleges.map((college) => (
                    <option key={college.name} value={college.name}>
                      {college.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className='text-sm font-semibold text-black block mb-1'>Description</label>
                <textarea
                  name='description'
                  value={deptForm.description}
                  onChange={(event) =>
                    setDeptForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div className='flex justify-end gap-2'>
                <button type='button' className='px-4 py-2 text-sm rounded-lg border border-gray-300' onClick={() => setDeptModalOpen(false)}>Cancel</button>
                <button type='submit' className='px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700'>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sectionModalOpen && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white text-black rounded-lg shadow-xl w-full max-w-lg p-4 sm:p-6 max-h-[90vh] overflow-y-auto'>
            <h3 className='text-xl font-semibold text-blue-950 mb-4'>
              {editingSection ? 'Edit Section' : 'Create Section'}
            </h3>

            {editingSection && !hasPriority && (
              <div className='mb-4 p-3 rounded-lg bg-yellow-50 text-yellow-800 border border-yellow-200'>
                ⚠️ {priorityError || 'Someone else is currently editing this section. You can view but cannot save changes.'}
              </div>
            )}

            {editingSection && hasPriority && (
              <div className='mb-4 p-3 rounded-lg bg-green-50 text-green-800 border border-green-200'>
                ✅ You have edit priority - your changes will be saved
              </div>
            )}

            <form className='space-y-4' onSubmit={submitSection}>
              <div>
                <label className='text-sm font-semibold text-black block mb-1'>College</label>
                <select
                  name='departmentId'
                  value={sectionForm.departmentId}
                  onChange={handleSectionInput}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  required
                >
                  <option value="">Select College</option>
                  {departments.map((dept) => (
                    <option key={dept._id} value={dept._id}>{dept.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className='text-sm font-semibold text-black block mb-1'>Section / Course Name</label>
                <input
                  type='text'
                  name='title'
                  value={sectionForm.title}
                  onChange={handleSectionInput}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  required
                />
              </div>
              <div>
                <label className='text-sm font-semibold text-black block mb-1'>Description</label>
                <textarea
                  name='description'
                  value={sectionForm.description}
                  onChange={handleSectionInput}
                  rows={3}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
              </div>
              <div>
                <label className='text-sm font-semibold text-black block mb-1'>
                  Policy PDF {editingSection ? '(Optional - leave empty to keep current file)' : ''}
                </label>
                <input
                  type='file'
                  accept='application/pdf'
                  onChange={(event) => setSectionFile(event.target.files[0] || null)}
                  required={!editingSection}
                  className='w-full'
                />
                {editingSection && (
                  <p className='text-xs text-gray-500 mt-1'>
                    Current file: {editingSection.fileName || 'No file'}
                  </p>
                )}
              </div>
              {message && (
                <div className={`rounded-lg px-4 py-3 text-sm ${
                  messageType === 'error' 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {message}
                </div>
              )}
              <div className='flex justify-end gap-2'>
                <button 
                  type='button' 
                  className='px-4 py-2 text-sm rounded-lg border border-gray-300' 
                  onClick={closeSectionModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type='submit'
                  disabled={submitting}
                  className={`px-4 py-2 text-sm rounded-lg font-semibold transition-colors ${
                    submitting
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {submitting 
                    ? (editingSection ? 'Updating...' : 'Creating...') 
                    : (editingSection ? 'Update' : 'Submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PresidentPolicy

