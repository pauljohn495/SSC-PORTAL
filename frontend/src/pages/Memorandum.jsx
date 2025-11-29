import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationDropdown from '../components/NotificationDropdown'


const Memorandum = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [memorandums, setMemorandums] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const { logout, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [highlightMemoId, setHighlightMemoId] = useState(null)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (user) {
      fetchMemorandums()
    }
  }, [user])

  // Show loading or nothing while checking auth
  if (authLoading || !user) {
    return null
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.has('memoId')) {
      setHighlightMemoId(params.get('memoId'))
    }
  }, [location.search])

  const fetchMemorandums = async () => {
    try {
      const response = await fetch('/api/memorandums')
      const data = await response.json()
      setMemorandums(data)
    } catch (error) {
      console.error('Error fetching memorandums:', error)
    }
  }

  useEffect(() => {
    if (!highlightMemoId) return
    const element = document.getElementById(`memo-${highlightMemoId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightMemoId, memorandums])

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleViewPDF = (fileUrl) => {
    try {
      if (fileUrl && fileUrl.startsWith('data:application/pdf')) {
        const base64Index = fileUrl.indexOf('base64,');
        if (base64Index !== -1) {
          const base64 = fileUrl.substring(base64Index + 7);
          const binaryString = atob(base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'application/pdf' });
          const objectUrl = URL.createObjectURL(blob);
          // Do NOT revoke the object URL immediately; keep it alive so the PDF loads fully
          window.open(objectUrl, '_blank', 'noopener,noreferrer');
          return;
        }
      }
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Failed to open PDF:', e);
    }
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    if (!searchQuery.trim()) {
      return
    }

    const params = new URLSearchParams()
    params.set('q', searchQuery.trim())
    params.set('type', 'memorandum')
    navigate(`/search?${params.toString()}`)
  }

  // Group memorandums by year
  const groupedMemorandums = memorandums.reduce((acc, memo) => {
    if (!acc[memo.year]) {
      acc[memo.year] = []
    }
    acc[memo.year].push(memo)
    return acc
  }, {})

  // Sort years in descending order
  const sortedYears = Object.keys(groupedMemorandums).sort((a, b) => parseInt(b) - parseInt(a))

  return (
    <div className='bg-white min-h-screen'>
      {/* Header */}
      <header className='bg-blue-950 text-white p-2 sm:p-4 flex justify-between items-center min-h-[64px]'>
        <div className='flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0'>
          <Link to="/" className='flex items-center space-x-1 sm:space-x-4 flex-shrink-0'>
            <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='h-8 sm:h-12 md:h-16 w-auto' />
            <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='h-8 sm:h-12 md:h-16 w-auto hidden sm:block' />
          </Link>
          <div className='flex flex-col justify-center min-w-0 flex-1'>
            <span className='text-xs sm:text-sm md:text-lg font-bold leading-tight truncate'>BUKIDNON STATE UNIVERSITY</span>
            <span className='text-xs sm:text-sm font-semibold leading-tight truncate'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>

        <div className='flex items-center space-x-1 sm:space-x-2 flex-shrink-0'>
          {user && user.role === 'admin' && (
            <button
              className='bg-white text-blue-950 px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm md:text-base font-semibold hover:bg-gray-200 transition cursor-pointer whitespace-nowrap'
              onClick={() => navigate('/admin-dashboard')}
            >
              <span className='hidden sm:inline'>Admin Dashboard</span>
              <span className='sm:hidden'>Admin</span>
            </button>
          )}
          {user && <NotificationDropdown />}
          <div className='relative'>
            <button
              className='text-white hover:bg-blue-900 p-1 sm:p-2 rounded-lg transition cursor-pointer'
              onClick={toggleMenu}
              aria-label="Menu"
            >
              <div className='w-5 sm:w-6 h-0.5 bg-white mb-1'></div>
              <div className='w-5 sm:w-6 h-0.5 bg-white mb-1'></div>
              <div className='w-5 sm:w-6 h-0.5 bg-white'></div>
            </button>
            {menuOpen && (
              <div className='absolute right-0 mt-2 w-48 sm:w-56 bg-white text-blue-950 rounded-lg shadow-lg z-50'>
                <ul className='py-2'>
                  <li className='px-4 py-2'><Link to="/" className="hover:underline block" onClick={() => setMenuOpen(false)}>Home</Link></li>
                  <li className='px-4 py-2'><Link to="/student-handbook" className="hover:underline block" onClick={() => setMenuOpen(false)}>Handbook</Link></li>
                  <li className='px-4 py-2'><Link to="/policy" className="hover:underline block" onClick={() => setMenuOpen(false)}>Policies</Link></li>
                  <li className='px-4 py-2'><Link to="/memorandum" className="hover:underline block" onClick={() => setMenuOpen(false)}>Memorandum</Link></li>
                  <li className='px-4 py-2'><Link to="/buksu-calendar" className="hover:underline block" onClick={() => setMenuOpen(false)}>BUKSU Calendar</Link></li>
                  <li className='px-4 py-2'><button onClick={() => { handleLogout(); setMenuOpen(false); }} className="hover:underline text-left w-full">Logout</button></li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className='p-4 sm:p-6 md:p-8'>
        <div className='max-w-5xl mx-auto'>
          <h1 className='text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-6 sm:mb-12 text-blue-950'>BUKIDNON STATE UNIVERSITY MEMO</h1>

          <section className='bg-white rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 text-blue-950 mb-6 sm:mb-12 border border-gray-100'>
            <h2 className='text-xl sm:text-2xl font-bold mb-4 sm:mb-6'>Search Memorandums</h2>
            <form onSubmit={handleSearchSubmit} className='grid grid-cols-1 md:grid-cols-5 gap-4 sm:gap-6'>
              <div className='md:col-span-3'>
                <label className='block text-sm font-semibold text-gray-700 mb-2'>Keyword</label>
                <input
                  type='text'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='Enter keyword or phrase'
                  className='w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                />
              </div>
              <div className='md:col-span-2 flex items-end'>
                <button
                  type='submit'
                  className='w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition'
                >
                  Search
                </button>
              </div>
            </form>
          </section>

          {sortedYears.length > 0 ? (
            sortedYears.map((year) => (
              <div key={year} className='mb-12'>
                <h2 className='text-3xl font-bold text-center mb-8 text-blue-950'>YEAR {year} SCHOOL MEMOS</h2>
                <div className='space-y-4'>
                  {groupedMemorandums[year].map((memo, index) => (
                    <div
                      key={memo._id}
                      id={`memo-${memo._id}`}
                      className={`flex items-center space-x-4 rounded-lg p-4 transition-shadow ${highlightMemoId === memo._id ? 'bg-blue-50 ring-2 ring-blue-500 shadow-md' : ''}`}
                    >
                      <button
                        onClick={() => handleViewPDF(memo.fileUrl)}
                        className='bg-red-600 text-white px-6 py-3 rounded font-bold hover:bg-red-700 transition-colors text-sm whitespace-nowrap'
                      >
                        SCHOOL MEMO {index + 1}
                      </button>
                      <p className='text-black text-lg flex-1'>{memo.title}</p>
                      {memo.fileName && (
                        <p className='text-gray-600 text-sm whitespace-nowrap'>{memo.fileName}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className='text-center text-gray-500 text-xl'>No memorandums available yet.</p>
          )}
        </div>
      </main>
    </div>
  )
}

export default Memorandum
