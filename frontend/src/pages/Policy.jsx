import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationDropdown from '../components/NotificationDropdown'

const Policy = () => {
  const { user, logout, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [departments, setDepartments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeDepartmentId, setActiveDepartmentId] = useState(null)
  const [activeSectionId, setActiveSectionId] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!user?._id) {
      return
    }
    const fetchPolicies = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await fetch(`/api/policies?userId=${user._id}`)
        let data = []
        if (response.ok) {
          data = await response.json()
        } else {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload.message || 'Failed to load policies')
        }
        setDepartments(Array.isArray(data) ? data : [])
        if (Array.isArray(data) && data.length > 0) {
          setActiveDepartmentId(data[0]._id)
          const firstSection = data[0].sections?.[0] || null
          setActiveSectionId(firstSection?._id || null)
        } else {
          setActiveDepartmentId(null)
          setActiveSectionId(null)
        }
      } catch (err) {
        console.error('Error loading policies:', err)
        setError(err.message || 'Failed to load policies')
        setDepartments([])
        setActiveDepartmentId(null)
        setActiveSectionId(null)
      } finally {
        setLoading(false)
      }
    }
    fetchPolicies()
  }, [user?._id])

  const activeDepartment = useMemo(
    () => departments.find((dept) => dept._id === activeDepartmentId) || null,
    [departments, activeDepartmentId]
  )
  const activeSection = useMemo(() => {
    if (!activeDepartment) return null
    return activeDepartment.sections?.find((section) => section._id === activeSectionId) || null
  }, [activeDepartment, activeSectionId])

  const toggleMenu = () => setMenuOpen((prev) => !prev)

  const handleLogout = () => {
    if (logout) {
      logout()
    }
    navigate('/login')
  }

  if (authLoading) {
    return (
      <div className='bg-white min-h-screen flex items-center justify-center'>
        <p className='text-gray-500'>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const viewerSrc = activeSection && user?._id
    ? `/api/policies/sections/${activeSection._id}/file?userId=${user._id}`
    : ''

  return (
    <div className='bg-white min-h-screen'>
      <header className='bg-blue-950 text-white p-4 flex justify-between items-center' style={{ height: '64px' }}>
        <div className='flex items-center space-x-4' style={{ height: '100%' }}>
          <Link to="/" className='flex items-center space-x-4'>
            <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" style={{ maxHeight: '128px', width: 'auto' }} />
            <img src="/src/assets/ssc-logo.png" alt="SSC Logo" style={{ maxHeight: '128px', width: 'auto' }} />
          </Link>
          <div className='flex flex-col justify-center' style={{ height: '100%' }}>
            <span className='text-lg font-bold leading-none'>BUKIDNON STATE UNIVERSITY</span>
            <span className='text-sm font-semibold leading-none pt-2'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <div className='flex items-center space-x-2'>
          {user && <NotificationDropdown />}
          <button
            className='text-white hover:bg-blue-900 p-2 rounded-lg transition cursor-pointer'
            onClick={toggleMenu}
            aria-label="Menu"
          >
            <div className='w-6 h-0.5 bg-white mb-1'></div>
            <div className='w-6 h-0.5 bg-white mb-1'></div>
            <div className='w-6 h-0.5 bg-white'></div>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div className='bg-blue-900 text-white p-4 absolute right-0 top-16 w-48 shadow-lg z-50'>
          <ul>
            <li className='py-2'><Link to="/" className="hover:underline">Home</Link></li>
            <li className='py-2'><Link to="/student-handbook" className="hover:underline">Handbook</Link></li>
            <li className='py-2'><Link to="/policy" className="hover:underline">Policies</Link></li>
            <li className='py-2'><Link to="/memorandum" className="hover:underline">Memorandum</Link></li>
            <li className='py-2'><Link to="/buksu-calendar" className="hover:underline">BUKSU Calendar</Link></li>
            <li className='py-2'><button onClick={handleLogout} className="hover:underline text-left w-full">Logout</button></li>
          </ul>
        </div>
      )}

      <main className='p-6 md:p-8'>
        <div className='max-w-6xl mx-auto'>
          <div className='flex justify-between items-center mb-6'>
            <div className='flex-1'></div>
            <h1 className='text-3xl font-bold text-center flex-1 text-blue-950'>DEPARTMENT POLICIES</h1>
            <div className='flex-1'></div>
          </div>

          {loading ? (
            <p className='text-center text-gray-500'>Loading policies...</p>
          ) : error ? (
            <div className='text-center text-red-600 bg-red-50 border border-red-200 rounded-lg p-4'>{error}</div>
          ) : departments.length === 0 ? (
            <div className='text-center py-12 text-gray-500'>
              Your department has no published policies yet.
            </div>
          ) : (
            <div className='flex flex-col lg:flex-row gap-6'>
              <aside className='w-full lg:w-64 space-y-4'>
                <div className='bg-white border border-gray-200 rounded-lg shadow-sm p-4'>
                  <div className='flex items-center justify-between mb-3'>
                    <h2 className='text-base font-semibold text-blue-950'>Departments</h2>
                  </div>
                  <div className='space-y-3 max-h-[70vh] overflow-y-auto'>
                    {departments.map((dept) => {
                      const isActiveDept = dept._id === activeDepartmentId
                      return (
                        <div key={dept._id} className='border border-gray-200 rounded-lg'>
                          <button
                            type='button'
                            onClick={() => {
                              setActiveDepartmentId(dept._id)
                              const nextSection = dept.sections?.[0]
                              setActiveSectionId(nextSection?._id || null)
                            }}
                            className={`w-full text-left px-3 py-2 rounded-t-lg text-sm font-semibold transition ${
                              isActiveDept ? 'bg-blue-50 text-blue-900' : 'bg-gray-50 text-gray-700'
                            }`}
                          >
                            {dept.name}
                          </button>
                          {isActiveDept && (
                            <div className='p-2 space-y-1'>
                              {dept.sections?.length ? (
                                dept.sections.map((section) => {
                                  const selected = section._id === activeSectionId
                                  return (
                                    <button
                                      key={section._id}
                                      type='button'
                                      onClick={() => setActiveSectionId(section._id)}
                                      className={`w-full text-left px-2 py-1 text-xs rounded transition ${
                                        selected ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-gray-700'
                                      }`}
                                    >
                                      {section.title}
                                    </button>
                                  )
                                })
                              ) : (
                                <p className='text-xs text-gray-500 px-2 py-1'>No approved sections yet.</p>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </aside>

              <div className='flex-1 min-w-0 space-y-6'>
                {activeSection ? (
                  <div className='bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden min-h-[500px]'>
                    <div className='border-b border-gray-100 p-4'>
                      <p className='text-xs uppercase text-gray-500 tracking-wide'>Active Section</p>
                      <h2 className='text-2xl font-semibold text-blue-950'>{activeSection.title}</h2>
                      {activeSection.description && (
                        <p className='text-sm text-gray-600 mt-1'>{activeSection.description}</p>
                      )}
                    </div>
                    {viewerSrc ? (
                      <iframe
                        key={activeSection._id}
                        src={viewerSrc}
                        title='Policy Viewer'
                        className='w-full h-[70vh]'
                        allowFullScreen
                      />
                    ) : (
                      <div className='flex items-center justify-center h-[70vh] text-gray-500'>
                        Unable to load policy.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className='text-center py-12 text-gray-500 bg-white rounded-lg shadow'>
                    Select a section to preview the policy document.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default Policy

