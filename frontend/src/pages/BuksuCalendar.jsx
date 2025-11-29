import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationDropdown from '../components/NotificationDropdown'

const BuksuCalendar = () => {
  const { user, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const toggleMenu = () => setMenuOpen(!menuOpen)
  const handleLogout = () => { logout(); setMenuOpen(false); navigate('/login') }

  const embedUrl = import.meta.env.VITE_GCAL_EMBED_URL || ''

  useEffect(() => {
    // Always log as empty by default since we can't reliably detect
    // if calendar has events in a cross-origin iframe
    console.log(JSON.stringify({
      method: 'GET',
      status: 204,
      message: 'Calendar is empty'
    }))
  }, [])

  return (
    <div className='bg-white min-h-screen'>
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

      <main className='p-4'>
        <div className='max-w-6xl mx-auto'>
          {embedUrl ? (
            <div className='w-full border rounded-md overflow-hidden'>
              <iframe
                title='Buksu Google Calendar'
                src={embedUrl}
                style={{ border: 0, width: '100%', height: '80vh' }}
                frameBorder='0'
                scrolling='no'
              ></iframe>
            </div>
          ) : (
            <div className='text-center text-blue-950 p-8 border rounded-md'>
              <p className='font-semibold mb-2'>Calendar not configured</p>
              <p>Ask the administrator to set VITE_GCAL_EMBED_URL in the frontend environment.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default BuksuCalendar


