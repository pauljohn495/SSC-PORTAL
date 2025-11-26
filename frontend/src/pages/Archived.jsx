import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { adminAPI } from '../services/api'
import Swal from 'sweetalert2'

const formatDateTime = (value) => {
  if (!value) {
    return 'Not available'
  }
  return new Date(value).toLocaleString()
}

const EmptyState = ({ message }) => (
  <div className='text-center py-8 text-gray-400 text-sm'>
    {message}
  </div>
)

const Archived = () => {
  const { logout, user } = useAuth()
  const navigate = useNavigate()
  const [archivedData, setArchivedData] = useState({
    handbooks: [],
    memorandums: [],
    users: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingKey, setProcessingKey] = useState('')

  const isAuthorized = !!user && user.role === 'admin'

  useEffect(() => {
    if (isAuthorized) {
      fetchArchived()
    }
  }, [isAuthorized])

  const fetchArchived = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await adminAPI.getArchivedItems()
      setArchivedData({
        handbooks: data.handbooks || [],
        memorandums: data.memorandums || [],
        users: data.users || []
      })
    } catch (err) {
      console.error('Error fetching archived data:', err)
      setError(err.message || 'Unable to load archived data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const runAction = async (key, action) => {
    try {
      setProcessingKey(key)
      setError('')
      await action()
      await fetchArchived()
    } catch (err) {
      console.error('Archived action error:', err)
      setError(err.message || 'Action failed. Please try again.')
    } finally {
      setProcessingKey('')
    }
  }

  const handleRestoreHandbook = (id) => {
    runAction(`handbook-restore-${id}`, () => adminAPI.restoreHandbook(id))
  }

  const handleDeleteHandbook = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Permanently Delete Handbook',
      text: 'Permanently delete this handbook? This cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it'
    });
    if (!result.isConfirmed) {
      return;
    }
    runAction(`handbook-delete-${id}`, () => adminAPI.deleteHandbookPermanent(id))
  }

  const handleRestoreMemorandum = (id) => {
    runAction(`memorandum-restore-${id}`, () => adminAPI.restoreMemorandum(id))
  }

  const handleDeleteMemorandum = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Permanently Delete Memorandum',
      text: 'Permanently delete this memorandum? This cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it'
    });
    if (!result.isConfirmed) {
      return;
    }
    runAction(`memorandum-delete-${id}`, () => adminAPI.deleteMemorandumPermanent(id))
  }

  const handleRestoreUser = (id) => {
    runAction(`user-restore-${id}`, () => adminAPI.restoreUser(id))
  }

  const handleDeleteUser = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Permanently Delete User',
      text: 'Permanently delete this user? This cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it'
    });
    if (!result.isConfirmed) {
      return;
    }
    runAction(`user-delete-${id}`, () => adminAPI.deleteUser(id))
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
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
          <li><Link to="/admin-policy" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Policy</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><Link to="/archived" className="block py-2 px-4 bg-blue-800 rounded transition">Archived</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          <div className='flex items-center justify-between mb-8'>
            <div>
              <h1 className='text-3xl font-bold text-blue-950'>Archived Records</h1>
              <p className='text-sm text-gray-600 mt-2'>Review previously archived student handbooks, memorandums, and users.</p>
            </div>
            <button
              onClick={fetchArchived}
              className='bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-2'
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>

          {error && (
            <div className='mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded'>{error}</div>
          )}

          {loading ? (
            <div className='text-center py-12 text-gray-500'>Loading archived data...</div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              <section className='bg-white rounded-lg shadow-md p-6 flex flex-col'>
                <header>
                  <h2 className='text-xl font-semibold text-blue-950'>Archived Student Handbooks</h2>
                  <p className='text-sm text-gray-500'>Total: {archivedData.handbooks.length}</p>
                </header>
                <div className='mt-4 space-y-4 overflow-y-auto max-h-[70vh] pr-1'>
                  {archivedData.handbooks.length === 0 && <EmptyState message="No archived handbooks yet." />}
                  {archivedData.handbooks.map((handbook) => {
                    const restoreKey = `handbook-restore-${handbook._id}`
                    const deleteKey = `handbook-delete-${handbook._id}`
                    return (
                    <div key={handbook._id} className='border border-gray-200 rounded-lg p-4'>
                      <h3 className='font-semibold text-gray-800 truncate'>{handbook.fileName || 'Untitled Handbook'}</h3>
                      <p className='text-sm text-gray-500 mt-1'>Status: <span className='font-medium text-gray-800 capitalize'>{handbook.status}</span></p>
                      <p className='text-sm text-gray-500'>Archived: <span className='font-medium text-gray-800'>{formatDateTime(handbook.archivedAt)}</span></p>
                      {handbook.createdBy && (
                        <p className='text-xs text-gray-400 mt-2'>Uploaded by {handbook.createdBy.name || handbook.createdBy.email}</p>
                      )}
                      <div className='flex items-center gap-2 mt-4'>
                        <button
                          onClick={() => handleRestoreHandbook(handbook._id)}
                          disabled={processingKey === restoreKey}
                          className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition-colors ${processingKey === restoreKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {processingKey === restoreKey ? 'Restoring...' : 'Restore'}
                        </button>
                        <button
                          onClick={() => handleDeleteHandbook(handbook._id)}
                          disabled={processingKey === deleteKey}
                          className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition-colors ${processingKey === deleteKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                        >
                          {processingKey === deleteKey ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </section>

              <section className='bg-white rounded-lg shadow-md p-6 flex flex-col'>
                <header>
                  <h2 className='text-xl font-semibold text-blue-950'>Archived Memorandums</h2>
                  <p className='text-sm text-gray-500'>Total: {archivedData.memorandums.length}</p>
                </header>
                <div className='mt-4 space-y-4 overflow-y-auto max-h-[70vh] pr-1'>
                  {archivedData.memorandums.length === 0 && <EmptyState message="No archived memorandums yet." />}
                  {archivedData.memorandums.map((memo) => {
                    const restoreKey = `memorandum-restore-${memo._id}`
                    const deleteKey = `memorandum-delete-${memo._id}`
                    return (
                    <div key={memo._id} className='border border-gray-200 rounded-lg p-4'>
                      <h3 className='font-semibold text-gray-800'>{memo.title}</h3>
                      <p className='text-sm text-gray-500 mt-1'>Year: <span className='font-medium text-gray-800'>{memo.year}</span></p>
                      <p className='text-sm text-gray-500'>Archived: <span className='font-medium text-gray-800'>{formatDateTime(memo.archivedAt)}</span></p>
                      <p className='text-xs text-gray-400 mt-2'>Status: <span className='uppercase font-semibold text-gray-700'>{memo.status}</span></p>
                      <div className='flex items-center gap-2 mt-4'>
                        <button
                          onClick={() => handleRestoreMemorandum(memo._id)}
                          disabled={processingKey === restoreKey}
                          className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition-colors ${processingKey === restoreKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {processingKey === restoreKey ? 'Restoring...' : 'Restore'}
                        </button>
                        <button
                          onClick={() => handleDeleteMemorandum(memo._id)}
                          disabled={processingKey === deleteKey}
                          className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition-colors ${processingKey === deleteKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                        >
                          {processingKey === deleteKey ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </section>

              <section className='bg-white rounded-lg shadow-md p-6 flex flex-col'>
                <header>
                  <h2 className='text-xl font-semibold text-blue-950'>Archived Users</h2>
                  <p className='text-sm text-gray-500'>Total: {archivedData.users.length}</p>
                </header>
                <div className='mt-4 space-y-4 overflow-y-auto max-h-[70vh] pr-1'>
                  {archivedData.users.length === 0 && <EmptyState message="No archived users yet." />}
                  {archivedData.users.map((archivedUser) => {
                    const restoreKey = `user-restore-${archivedUser._id}`
                    const deleteKey = `user-delete-${archivedUser._id}`
                    return (
                    <div key={archivedUser._id} className='border border-gray-200 rounded-lg p-4'>
                      <h3 className='font-semibold text-gray-800'>{archivedUser.name || archivedUser.email}</h3>
                      <p className='text-sm text-gray-500 mt-1'>Role: <span className='uppercase font-semibold text-gray-700'>{archivedUser.role}</span></p>
                      <p className='text-sm text-gray-500'>Archived: <span className='font-medium text-gray-800'>{formatDateTime(archivedUser.archivedAt)}</span></p>
                      <p className='text-xs text-gray-400 mt-2'>Email: {archivedUser.email}</p>
                      <div className='flex items-center gap-2 mt-4'>
                        <button
                          onClick={() => handleRestoreUser(archivedUser._id)}
                          disabled={processingKey === restoreKey}
                          className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition-colors ${processingKey === restoreKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {processingKey === restoreKey ? 'Restoring...' : 'Restore'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(archivedUser._id)}
                          disabled={processingKey === deleteKey}
                          className={`flex-1 px-3 py-2 rounded text-sm font-semibold transition-colors ${processingKey === deleteKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                        >
                          {processingKey === deleteKey ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default Archived

