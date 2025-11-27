import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Swal from 'sweetalert2'

const statusFilters = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' }
]

const AdminPolicy = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('pending')
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoadingId, setActionLoadingId] = useState(null)

  const isAuthorized = useMemo(() => user?.role === 'admin', [user?.role])

  useEffect(() => {
    if (!user) return
    if (!isAuthorized) {
      navigate('/login')
      return
    }
    fetchSections(status)
  }, [user?._id, status, isAuthorized, navigate])

  const fetchSections = async (filterStatus) => {
    try {
      setLoading(true)
      setError('')
      const response = await fetch(`/api/admin/policies/sections?status=${filterStatus}`)
      if (!response.ok) {
        throw new Error('Failed to load policy sections')
      }
      const data = await response.json()
      setSections(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching policies:', err)
      setError(err.message || 'Failed to load sections')
      setSections([])
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

  const reviewSection = async (sectionId, newStatus) => {
    let rejectionReason = null
    if (newStatus === 'rejected') {
      rejectionReason = window.prompt('Enter rejection reason (optional)', '') || ''
    }
    try {
      setActionLoadingId(sectionId)
      const response = await fetch(`/api/admin/policies/sections/${sectionId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: user._id,
          status: newStatus,
          rejectionReason
        })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update status')
      }
      fetchSections(status)
    } catch (err) {
      console.error('Error updating section status:', err)
      setError(err.message || 'Failed to update section status')
    } finally {
      setActionLoadingId(null)
    }
  }

  const archiveSection = async (sectionId) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Archive Policy Section',
      text: 'Are you sure you want to archive this policy section?',
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, archive it'
    })
    if (!result.isConfirmed) {
      return
    }
    try {
      setActionLoadingId(sectionId)
      const response = await fetch(`/api/admin/policies/sections/${sectionId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user._id })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || 'Failed to archive section')
      }
      Swal.fire({
        icon: 'success',
        title: 'Archived',
        text: 'Policy section has been archived.',
        timer: 1500,
        showConfirmButton: false
      })
      fetchSections(status)
    } catch (err) {
      console.error('Error archiving section:', err)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err.message || 'Failed to archive section'
      })
      setError(err.message || 'Failed to archive section')
    } finally {
      setActionLoadingId(null)
    }
  }

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
          <li><Link to="/admin-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/admin-policy" className="block py-2 px-4 bg-blue-800 rounded transition">Policy</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><Link to="/archived" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Archived</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      <main className="flex-1 bg-gray-100 p-8">
        <div className='max-w-6xl mx-auto space-y-6'>
          <div className='flex flex-col md:flex-row md:items-center md:justify-between gap-3'>
            <div>
              <h1 className='text-3xl font-bold text-blue-950'>Policy Approvals</h1>
              <p className='text-gray-600'>Review sections submitted by the president.</p>
            </div>
            <div className='flex items-center gap-2 bg-white rounded-lg shadow px-3 py-2'>
              <span className='text-sm font-semibold text-gray-600'>Status:</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className='border border-gray-300 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-black'
              >
                {statusFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>{filter.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className='rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm'>
              {error}
            </div>
          )}

          {loading ? (
            <div className='text-center text-gray-500 py-12'>Loading sections...</div>
          ) : sections.length === 0 ? (
            <div className='text-center text-gray-500 py-12 bg-white rounded-lg shadow'>No sections found for this status.</div>
          ) : (
            <div className='bg-white rounded-lg shadow overflow-hidden'>
              <div className='grid grid-cols-12 gap-4 px-4 py-3 border-b text-sm font-semibold text-gray-600'>
                <span className='col-span-3'>Section</span>
                <span className='col-span-3'>College</span>
                <span className='col-span-2'>Submitted By</span>
                <span className='col-span-2'>Submitted</span>
                <span className='col-span-2 text-right'>Actions</span>
              </div>
              {sections.map((section) => (
                <div key={section._id} className='grid grid-cols-12 gap-4 px-4 py-4 border-b text-sm text-gray-700'>
                  <div className='col-span-3'>
                    <p className='font-semibold text-gray-900'>{section.title}</p>
                    {section.description && (
                      <p className='text-xs text-gray-500 line-clamp-2'>{section.description}</p>
                    )}
                  </div>
                  <div className='col-span-3'>
                    <p className='font-semibold'>{section.department?.name || 'Unknown'}</p>
                    <p className='text-xs text-gray-500'>{section.department?.accessKey}</p>
                  </div>
                  <div className='col-span-2'>
                    <p>{section.createdBy?.name || 'Unknown'}</p>
                    <p className='text-xs text-gray-500'>{section.createdBy?.email || '-'}</p>
                  </div>
                  <div className='col-span-2 text-sm text-gray-500'>
                    {new Date(section.createdAt).toLocaleString()}
                  </div>
                  <div className='col-span-2 flex items-center justify-end gap-2'>
                    {status === 'pending' ? (
                      <>
                        <button
                          onClick={() => reviewSection(section._id, 'rejected')}
                          disabled={actionLoadingId === section._id}
                          className='px-3 py-1 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 text-xs font-semibold disabled:opacity-50'
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => reviewSection(section._id, 'approved')}
                          disabled={actionLoadingId === section._id}
                          className='px-3 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs font-semibold disabled:opacity-50'
                        >
                          Approve
                        </button>
                      </>
                    ) : (
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        section.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {section.status.toUpperCase()}
                      </span>
                    )}
                    <button
                      onClick={() => archiveSection(section._id)}
                      disabled={actionLoadingId === section._id}
                      className='px-3 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-semibold disabled:opacity-50'
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default AdminPolicy

