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
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

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

  const submitSection = async (event) => {
    event.preventDefault()
    if (!sectionForm.departmentId || !sectionForm.title.trim() || !sectionFile) {
      setMessage('Department, title, and PDF are required')
      setMessageType('error')
      return
    }
    try {
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
      setSectionModalOpen(false)
      setSectionForm({ departmentId: '', title: '', description: '' })
      setSectionFile(null)
      fetchDepartments()
      setMessage('Section submitted for approval')
      setMessageType('success')
    } catch (error) {
      console.error('Error creating section:', error)
      setMessage(error.message || 'Failed to create section')
      setMessageType('error')
    }
  }

  const handleRenameDepartment = async (department) => {
    const nextName = window.prompt('Enter new department name', department.name)
    if (!nextName || nextName.trim() === department.name) {
      return
    }
    try {
      const response = await fetch(`/api/president/policies/departments/${department._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user._id,
          name: nextName.trim()
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || 'Failed to rename department')
      }
      fetchDepartments()
      setMessage('Department updated')
      setMessageType('success')
    } catch (error) {
      setMessage(error.message || 'Failed to rename department')
      setMessageType('error')
    }
  }

  const filteredDepartments = useMemo(() => {
    if (statusFilter === 'all') {
      return departments
    }
    return departments.map((dept) => ({
      ...dept,
      sections: (dept.sections || []).filter((section) => section.status === statusFilter)
    }))
  }, [departments, statusFilter])

  if (!isAuthorized) {
    return <div>Access Denied</div>
  }

  return (
    <div className='bg-white min-h-screen flex'>
      <aside className='bg-blue-950 text-white w-64 min-h-screen p-4'>
        <div className='mb-8'>
          <div className='flex items-center justify-center space-x-4 mb-4'>
            <Link to="/" className='flex items-center space-x-4'>
              <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-20 h-auto' />
              <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='w-20 h-auto' />
            </Link>
          </div>
          <div className='text-center'>
            <span className='text-sm font-bold leading-none'>BUKIDNON STATE UNIVERSITY</span>
            <br />
            <span className='text-xs font-semibold leading-none'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <ul className='space-y-4'>
          <li><Link to="/president-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/president-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/president-policy" className="block py-2 px-4 bg-blue-800 rounded transition">Policy</Link></li>
          <li><Link to="/president-calendar" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Calendar</Link></li>
          <li><Link to="/president-notifications" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Notifications</Link></li>
          <li><Link to="/president-activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      <main className="flex-1 bg-gray-100 p-8">
        <div className='max-w-6xl mx-auto space-y-6'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
            <div>
              <h1 className='text-3xl font-bold text-blue-950'>Policy Management</h1>
              <p className='text-gray-600'>Organize departments and course-specific policies.</p>
            </div>
            <div className='flex flex-wrap gap-2'>
              <button
                onClick={() => setDeptModalOpen(true)}
                className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold'
              >
                Create Department
              </button>
              <button
                onClick={() => setSectionModalOpen(true)}
                className='px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition text-sm font-semibold'
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

          <div className='bg-white rounded-lg shadow-md p-4 flex items-center justify-between'>
            <span className='text-sm font-semibold text-gray-600'>Filter sections:</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className='border border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {loading ? (
            <div className='text-center text-gray-500 py-12'>Loading departments...</div>
          ) : filteredDepartments.length === 0 ? (
            <div className='text-center text-gray-500 py-12 bg-white rounded-lg shadow'>No departments yet.</div>
          ) : (
            <div className='space-y-6'>
              {filteredDepartments.map((department) => (
                <div key={department._id} className='bg-white rounded-lg shadow border border-gray-200'>
                  <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-gray-100 p-4'>
                    <div>
                      <h2 className='text-xl font-semibold text-blue-950'>{department.name}</h2>
                      {department.description && (
                        <p className='text-sm text-gray-600 mt-1'>{department.description}</p>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        className='text-sm text-blue-600 hover:text-blue-800'
                        onClick={() => handleRenameDepartment(department)}
                      >
                        Rename
                      </button>
                    </div>
                  </div>
                  <div className='p-4 space-y-3'>
                    {department.sections && department.sections.length > 0 ? (
                      department.sections.map((section) => (
                        <div key={section._id} className='border border-gray-200 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
                          <div>
                            <p className='font-semibold text-gray-800'>{section.title}</p>
                            {section.description && (
                              <p className='text-sm text-gray-600'>{section.description}</p>
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
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className='text-sm text-gray-500'>No sections for this department.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {deptModalOpen && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white text-black rounded-lg shadow-xl w-full max-w-lg p-6'>
            <h3 className='text-xl font-semibold text-blue-950 mb-4'>Create Department</h3>
            <form className='space-y-4' onSubmit={submitDepartment}>
              <div>
                <label className='text-sm font-semibold text-black block mb-1'>Department</label>
                <select
                  name='name'
                  value={deptForm.name}
                  onChange={(event) => setDeptForm((prev) => ({ ...prev, name: event.target.value }))}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
                  required
                >
                  <option value="">Select department</option>
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
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
          <div className='bg-white text-black rounded-lg shadow-xl w-full max-w-lg p-6'>
            <h3 className='text-xl font-semibold text-blue-950 mb-4'>Create Section</h3>
            <form className='space-y-4' onSubmit={submitSection}>
              <div>
                <label className='text-sm font-semibold text-black block mb-1'>Department</label>
                <select
                  name='departmentId'
                  value={sectionForm.departmentId}
                  onChange={handleSectionInput}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500'
                  required
                >
                  <option value="">Select department</option>
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
                <label className='text-sm font-semibold text-black block mb-1'>Policy PDF</label>
                <input
                  type='file'
                  accept='application/pdf'
                  onChange={(event) => setSectionFile(event.target.files[0] || null)}
                  required
                  className='w-full'
                />
              </div>
              <div className='flex justify-end gap-2'>
                <button type='button' className='px-4 py-2 text-sm rounded-lg border border-gray-300' onClick={() => setSectionModalOpen(false)}>Cancel</button>
                <button type='submit' className='px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700'>Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default PresidentPolicy

