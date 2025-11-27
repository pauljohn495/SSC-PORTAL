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

      {menuOpen && (
        <div className='bg-blue-900 text-white p-4 absolute right-0 top-16 w-48 shadow-lg'>
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


