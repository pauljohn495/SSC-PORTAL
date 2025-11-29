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
    users: [],
    policySections: [],
    handbookSections: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingKey, setProcessingKey] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

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
      const [data, policySections, handbookSections] = await Promise.all([
        adminAPI.getArchivedItems(),
        adminAPI.getArchivedPolicySections(),
        adminAPI.getArchivedHandbookSections()
      ])
      setArchivedData({
        handbooks: data.handbooks || [],
        memorandums: data.memorandums || [],
        users: data.users || [],
        policySections: policySections || [],
        handbookSections: handbookSections || []
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

  const handleRestorePolicySection = async (id) => {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Restore Policy Section',
      text: 'Are you sure you want to restore this policy section?',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, restore it'
    });
    if (!result.isConfirmed) {
      return;
    }
    runAction(`policy-restore-${id}`, () => adminAPI.restorePolicySection(id, user._id))
  }

  const handleDeletePolicySection = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Permanently Delete Policy Section',
      text: 'Permanently delete this policy section? This cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it'
    });
    if (!result.isConfirmed) {
      return;
    }
    runAction(`policy-delete-${id}`, () => adminAPI.deletePolicySectionPermanent(id, user._id))
  }

  const handleRestoreHandbookSection = async (id) => {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Restore Handbook Section',
      text: 'Are you sure you want to restore this handbook section?',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, restore it'
    });
    if (!result.isConfirmed) {
      return;
    }
    runAction(`hbsection-restore-${id}`, () => adminAPI.restoreHandbookSection(id, user._id))
  }

  const handleDeleteHandbookSection = async (id) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Permanently Delete Handbook Section',
      text: 'Permanently delete this handbook section? This cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it'
    });
    if (!result.isConfirmed) {
      return;
    }
    runAction(`hbsection-delete-${id}`, () => adminAPI.deleteHandbookSectionPermanent(id, user._id))
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
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
          <li><Link to="/admin-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Handbook</Link></li>
          <li><Link to="/admin-policy" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Policy</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Activity Logs</Link></li>
          <li><Link to="/archived" className="block py-2 px-4 bg-blue-800 rounded transition" onClick={() => setSidebarOpen(false)}>Archived</Link></li>
          <li><Link to="/admin-backup" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Backup</Link></li>
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
        <div className="max-w-6xl mx-auto">
          <div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8'>
            <div>
              <h1 className='text-2xl sm:text-3xl font-bold text-blue-950'>Archived Records</h1>
              <p className='text-xs sm:text-sm text-gray-600 mt-2'>Review previously archived handbook sections, memorandums, users, and policy sections.</p>
            </div>
            <button
              onClick={fetchArchived}
              className='bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-2 min-h-[44px]'
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className='hidden sm:inline'>Refresh</span>
            </button>
          </div>

          {error && (
            <div className='mb-6 p-4 bg-red-100 border border-red-200 text-red-700 rounded'>{error}</div>
          )}

          {loading ? (
            <div className='text-center py-12 text-gray-500'>Loading archived data...</div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6'>
              <section className='bg-white rounded-lg shadow-md p-4 sm:p-6 flex flex-col'>
                <header>
                  <h2 className='text-lg sm:text-xl font-semibold text-blue-950'>Archived Handbook Sections</h2>
                  <p className='text-xs sm:text-sm text-gray-500'>Total: {archivedData.handbookSections.length}</p>
                </header>
                <div className='mt-4 space-y-4 overflow-y-auto max-h-[70vh] pr-1'>
                  {archivedData.handbookSections.length === 0 && <EmptyState message="No archived handbook sections yet." />}
                  {archivedData.handbookSections.map((section) => {
                    const restoreKey = `hbsection-restore-${section._id}`
                    const deleteKey = `hbsection-delete-${section._id}`
                    return (
                    <div key={section._id} className='border border-gray-200 rounded-lg p-3 sm:p-4'>
                      <h3 className='font-semibold text-gray-800 truncate text-sm sm:text-base'>{section.title}</h3>
                      <p className='text-xs sm:text-sm text-gray-500 mt-1'>Status: <span className='font-medium text-gray-800 capitalize'>{section.status}</span></p>
                      <p className='text-xs sm:text-sm text-gray-500'>Archived: <span className='font-medium text-gray-800'>{formatDateTime(section.archivedAt)}</span></p>
                      {section.createdBy && (
                        <p className='text-xs text-gray-400 mt-2'>Created by {section.createdBy.name || section.createdBy.email}</p>
                      )}
                      <div className='flex items-center gap-2 mt-3 sm:mt-4'>
                        <button
                          onClick={() => handleRestoreHandbookSection(section._id)}
                          disabled={processingKey === restoreKey}
                          className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${processingKey === restoreKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {processingKey === restoreKey ? 'Restoring...' : 'Restore'}
                        </button>
                        <button
                          onClick={() => handleDeleteHandbookSection(section._id)}
                          disabled={processingKey === deleteKey}
                          className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${processingKey === deleteKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                        >
                          {processingKey === deleteKey ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </section>

              <section className='bg-white rounded-lg shadow-md p-4 sm:p-6 flex flex-col'>
                <header>
                  <h2 className='text-lg sm:text-xl font-semibold text-blue-950'>Archived Memorandums</h2>
                  <p className='text-xs sm:text-sm text-gray-500'>Total: {archivedData.memorandums.length}</p>
                </header>
                <div className='mt-4 space-y-4 overflow-y-auto max-h-[70vh] pr-1'>
                  {archivedData.memorandums.length === 0 && <EmptyState message="No archived memorandums yet." />}
                  {archivedData.memorandums.map((memo) => {
                    const restoreKey = `memorandum-restore-${memo._id}`
                    const deleteKey = `memorandum-delete-${memo._id}`
                    return (
                    <div key={memo._id} className='border border-gray-200 rounded-lg p-3 sm:p-4'>
                      <h3 className='font-semibold text-gray-800 text-sm sm:text-base break-words'>{memo.title}</h3>
                      <p className='text-xs sm:text-sm text-gray-500 mt-1'>Year: <span className='font-medium text-gray-800'>{memo.year}</span></p>
                      <p className='text-xs sm:text-sm text-gray-500'>Archived: <span className='font-medium text-gray-800'>{formatDateTime(memo.archivedAt)}</span></p>
                      <p className='text-xs text-gray-400 mt-2'>Status: <span className='uppercase font-semibold text-gray-700'>{memo.status}</span></p>
                      <div className='flex items-center gap-2 mt-3 sm:mt-4'>
                        <button
                          onClick={() => handleRestoreMemorandum(memo._id)}
                          disabled={processingKey === restoreKey}
                          className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${processingKey === restoreKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {processingKey === restoreKey ? 'Restoring...' : 'Restore'}
                        </button>
                        <button
                          onClick={() => handleDeleteMemorandum(memo._id)}
                          disabled={processingKey === deleteKey}
                          className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${processingKey === deleteKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                        >
                          {processingKey === deleteKey ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </section>

              <section className='bg-white rounded-lg shadow-md p-4 sm:p-6 flex flex-col'>
                <header>
                  <h2 className='text-lg sm:text-xl font-semibold text-blue-950'>Archived Users</h2>
                  <p className='text-xs sm:text-sm text-gray-500'>Total: {archivedData.users.length}</p>
                </header>
                <div className='mt-4 space-y-4 overflow-y-auto max-h-[70vh] pr-1'>
                  {archivedData.users.length === 0 && <EmptyState message="No archived users yet." />}
                  {archivedData.users.map((archivedUser) => {
                    const restoreKey = `user-restore-${archivedUser._id}`
                    const deleteKey = `user-delete-${archivedUser._id}`
                    return (
                    <div key={archivedUser._id} className='border border-gray-200 rounded-lg p-3 sm:p-4'>
                      <h3 className='font-semibold text-gray-800 text-sm sm:text-base break-words'>{archivedUser.name || archivedUser.email}</h3>
                      <p className='text-xs sm:text-sm text-gray-500 mt-1'>Role: <span className='uppercase font-semibold text-gray-700'>{archivedUser.role}</span></p>
                      <p className='text-xs sm:text-sm text-gray-500'>Archived: <span className='font-medium text-gray-800'>{formatDateTime(archivedUser.archivedAt)}</span></p>
                      <p className='text-xs text-gray-400 mt-2 break-words'>Email: {archivedUser.email}</p>
                      <div className='flex items-center gap-2 mt-3 sm:mt-4'>
                        <button
                          onClick={() => handleRestoreUser(archivedUser._id)}
                          disabled={processingKey === restoreKey}
                          className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${processingKey === restoreKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {processingKey === restoreKey ? 'Restoring...' : 'Restore'}
                        </button>
                        <button
                          onClick={() => handleDeleteUser(archivedUser._id)}
                          disabled={processingKey === deleteKey}
                          className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${processingKey === deleteKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                        >
                          {processingKey === deleteKey ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  )})}
                </div>
              </section>

              <section className='bg-white rounded-lg shadow-md p-4 sm:p-6 flex flex-col'>
                <header>
                  <h2 className='text-lg sm:text-xl font-semibold text-blue-950'>Archived Policy Sections</h2>
                  <p className='text-xs sm:text-sm text-gray-500'>Total: {archivedData.policySections.length}</p>
                </header>
                <div className='mt-4 space-y-4 overflow-y-auto max-h-[70vh] pr-1'>
                  {archivedData.policySections.length === 0 && <EmptyState message="No archived policy sections yet." />}
                  {archivedData.policySections.map((section) => {
                    const restoreKey = `policy-restore-${section._id}`
                    const deleteKey = `policy-delete-${section._id}`
                    return (
                    <div key={section._id} className='border border-gray-200 rounded-lg p-3 sm:p-4'>
                      <h3 className='font-semibold text-gray-800 truncate text-sm sm:text-base'>{section.title}</h3>
                      <p className='text-xs sm:text-sm text-gray-500 mt-1'>Department: <span className='font-medium text-gray-800'>{section.department?.name || 'Unknown'}</span></p>
                      <p className='text-xs sm:text-sm text-gray-500'>Status: <span className='font-medium text-gray-800 capitalize'>{section.status}</span></p>
                      <p className='text-xs sm:text-sm text-gray-500'>Archived: <span className='font-medium text-gray-800'>{formatDateTime(section.archivedAt)}</span></p>
                      {section.createdBy && (
                        <p className='text-xs text-gray-400 mt-2'>Created by {section.createdBy.name || section.createdBy.email}</p>
                      )}
                      <div className='flex items-center gap-2 mt-3 sm:mt-4'>
                        <button
                          onClick={() => handleRestorePolicySection(section._id)}
                          disabled={processingKey === restoreKey}
                          className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${processingKey === restoreKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {processingKey === restoreKey ? 'Restoring...' : 'Restore'}
                        </button>
                        <button
                          onClick={() => handleDeletePolicySection(section._id)}
                          disabled={processingKey === deleteKey}
                          className={`flex-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-semibold transition-colors min-h-[44px] ${processingKey === deleteKey ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
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

