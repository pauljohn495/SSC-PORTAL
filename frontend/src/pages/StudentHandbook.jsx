import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationDropdown from '../components/NotificationDropdown'

const StudentHandbook = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [handbookPages, setHandbookPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [pdfError, setPdfError] = useState(null)
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const downloadMenuRef = useRef(null)
  const pdfIframeRef = useRef(null)
  const { logout, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Define fetchHandbook using useCallback so it can be used in useEffect
  const fetchHandbook = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:5001/api/handbook')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch handbook: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Fetched handbook data:', data) // Debug log
      
      // Get the first approved handbook (should only be one now)
      const approvedHandbooks = data.filter(h => h.status === 'approved')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Get most recent
      
      console.log(`Found ${approvedHandbooks.length} approved handbook(s)`)
      
      setHandbookPages(approvedHandbooks)
    } catch (error) {
      console.error('Error fetching handbook:', error)
      setPdfError(`Failed to load handbook: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (user) {
      fetchHandbook()
    }
  }, [user, fetchHandbook])

  // Get the current handbook (should be only one)
  const currentHandbook = handbookPages.length > 0 ? handbookPages[0] : null

  // Reset PDF loaded state when handbook changes
  useEffect(() => {
    setPdfLoaded(false)
  }, [currentHandbook?._id])

  // Close download menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target)) {
        setDownloadMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])


  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const getHandbookPreviewUrl = useCallback((handbook) => {
    if (!handbook) return ''
    if (handbook.googleDrivePreviewUrl) return handbook.googleDrivePreviewUrl
    if (handbook.googleDriveFileId) {
      return `https://drive.google.com/file/d/${handbook.googleDriveFileId}/preview`
    }
    if (handbook.fileUrl) {
      return handbook.fileUrl.startsWith('data:') || handbook.fileUrl.startsWith('http')
        ? handbook.fileUrl
        : `http://localhost:5001/${handbook.fileUrl}`
    }
    return ''
  }, [])

  const downloadHandbook = () => {
    if (!currentHandbook) return

    // If Google Drive file ID exists, download from Google Drive
    if (currentHandbook.googleDriveFileId) {
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${currentHandbook.googleDriveFileId}`
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = currentHandbook.fileName || 'Student-Handbook.pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setDownloadMenuOpen(false)
      return
    }

    // Fallback to old fileUrl if Google Drive not available
    if (currentHandbook.fileUrl) {
      const link = document.createElement('a')
      const fileUrl = currentHandbook.fileUrl.startsWith('data:') || currentHandbook.fileUrl.startsWith('http')
        ? currentHandbook.fileUrl
        : `http://localhost:5001/${currentHandbook.fileUrl}`
      link.href = fileUrl
      link.download = currentHandbook.fileName || 'Student-Handbook.pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setDownloadMenuOpen(false)
      return
    }

    alert('Handbook file not available for download')
  }

  const previewUrl = useMemo(() => getHandbookPreviewUrl(currentHandbook), [currentHandbook, getHandbookPreviewUrl])

  // Show loading or nothing while checking auth
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

  return (
    <div className='bg-white min-h-screen'>
      {/* Header */}
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
          {user && user.role === 'admin' && (
            <button
              className='bg-white text-blue-950 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition cursor-pointer'
              onClick={() => navigate('/admin-dashboard')}
            >
              Admin Dashboard
            </button>
          )}
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

      {/* Menu (if open) */}
      {menuOpen && (
        <div className='bg-blue-900 text-white p-4 absolute right-0 top-16 w-48 shadow-lg'>
          <ul>
            <li className='py-2'><Link to="/" className="hover:underline">Home</Link></li>
            <li className='py-2'><Link to="/student-handbook" className="hover:underline">Handbook</Link></li>
            <li className='py-2'><Link to="/memorandum" className="hover:underline">Memorandum</Link></li>
            <li className='py-2'><Link to="/search" className="hover:underline">Search</Link></li>
            <li className='py-2'><Link to="/buksu-calendar" className="hover:underline">BUKSU Calendar</Link></li>

            <li className='py-2'><button onClick={handleLogout} className="hover:underline text-left w-full">Logout</button></li>
          </ul>
        </div>
      )}

      {/* Main Content */}
      <main className='p-8'>
        <div className='max-w-4xl mx-auto relative'>
          <div className='flex justify-between items-center mb-6'>
            <div className='flex-1'></div>
            <h1 className='text-3xl font-bold text-center flex-1 text-blue-950'>STUDENT HANDBOOK</h1>
            {/* Download Button */}
            {!loading && currentHandbook ? (
              <div className='relative flex-1 flex justify-end' ref={downloadMenuRef}>
                <button
                  onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
                  className='text-blue-950 hover:bg-blue-100 p-2 rounded-lg transition cursor-pointer'
                  title="Download"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                {downloadMenuOpen && (
                  <div className='absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-50 border border-gray-200'>
                    <button
                      onClick={downloadHandbook}
                      className='block w-full text-left px-4 py-3 hover:bg-gray-100 transition rounded-lg text-black'
                    >
                      Download Handbook
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className='flex-1'></div>
            )}
          </div>
          

          {loading ? (
            <p className='text-center text-gray-500'>Loading...</p>
          ) : !currentHandbook ? (
            <div className='text-center py-12'>
              <p className='text-gray-500 text-lg mb-2'>
                No handbook content available yet.
              </p>
            </div>
          ) : (
            <>
              {/* Handbook Display */}
              <div className='bg-gray-100 p-8 rounded-lg shadow-md min-h-[400px] mb-6'>
                {previewUrl ? (
                  <div className='w-full rounded-lg overflow-hidden bg-black' style={{ minHeight: '800px' }}>
                    <div className='bg-black'>
                      {pdfError ? (
                        <div className='text-center py-12 bg-red-50 rounded-lg m-4'>
                          <p className='text-red-600 mb-4'>Error loading PDF: {pdfError}</p>
                          <button
                            onClick={() => {
                              setPdfError(null)
                              if (pdfIframeRef.current) {
                                pdfIframeRef.current.src = previewUrl
                              }
                            }}
                            className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                          >
                            Retry
                          </button>
                        </div>
                      ) : (
                        <iframe
                          ref={pdfIframeRef}
                          src={previewUrl}
                          className='w-full h-full border-0 rounded-b-lg'
                          style={{ minHeight: '760px', height: '100vh', backgroundColor: '#202124' }}
                          title={currentHandbook.fileName || 'Student Handbook'}
                          onError={() => {
                            console.error('PDF iframe error')
                            setPdfError('Failed to load PDF from Google Drive. Please check if the file exists.')
                          }}
                          onLoad={() => {
                            setPdfError(null)
                            setPdfLoaded(true)
                          }}
                        />
                      )}
                    </div>
                  </div>
                ) : currentHandbook.content ? (
                  <div className='prose max-w-none'>
                    <div className='text-gray-700 leading-relaxed whitespace-pre-wrap text-base'>
                      {currentHandbook.content}
                    </div>
                  </div>
                ) : (
                  <div className='text-center py-12 text-gray-500'>
                    No handbook content available.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

    </div>
  )
}

export default StudentHandbook
