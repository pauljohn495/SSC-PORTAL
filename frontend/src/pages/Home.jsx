import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationDropdown from '../components/NotificationDropdown'
import buksublack from '../assets/buksu-black.png'
import bgimage from '../assets/bg-image.jpg'
import buksunew from '../assets/buksu-new.png'
const Home = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const MemorandumClick = () => {
    if (user) {
      navigate('/memorandum')
    } else {
      navigate('/login')
    }
  }

  const HandbookClick = () => {
    if (user) {
      navigate('/student-handbook')
    } else {
      navigate('/login')
    }
  }

  const AdminDashboardClick = () => {
    if (user) {
      navigate('/admin-dashboard')
    } else {
      navigate('/login')
    }
  }

  const PresidentDashboardClick = () => {
    if (user) {
      navigate('/president-dashboard')
    } else {
      navigate('/login')
    }
  }

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    navigate('/login')
  }


  return (
    <div className='s text-black w-full min-h-screen flex flex-col'>
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
              onClick={AdminDashboardClick}
            >
              Admin Dashboard
            </button>
          )}
          {user && user.role === 'president' && (
            <button
              className='bg-white text-blue-950 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition cursor-pointer'
              onClick={PresidentDashboardClick}
            >
              President Dashboard
            </button>
          )}
          {user && (
            <>
              <NotificationDropdown />
              <div className='relative'>
                <button
                  className='text-white hover:bg-blue-900 p-2 rounded-lg transition cursor-pointer'
                  onClick={toggleMenu}
                  aria-label="Menu"
                >
                  <div className='w-6 h-0.5 bg-white mb-1'></div>
                  <div className='w-6 h-0.5 bg-white mb-1'></div>
                  <div className='w-6 h-0.5 bg-white'></div>
                </button>
                {menuOpen && (
                  <div className='absolute right-0 mt-2 w-48 bg-white text-blue-950 rounded-lg shadow-lg z-10'>
                    <ul className='py-2'>
                      <li className='px-4 py-2'><Link to="/" className="hover:underline">Home</Link></li>
                      <li className='px-4 py-2'><Link to="/student-handbook" className="hover:underline">Handbook</Link></li>
                      <li className='px-4 py-2'><Link to="/memorandum" className="hover:underline">Memorandum</Link></li>
                      <li className='px-4 py-2'><Link to="/buksu-calendar" className="hover:underline">BUKSU Calendar</Link></li>
                      <li className='px-4 py-2'><Link to="/search" className="hover:underline">Search</Link></li>
                      <li className='px-4 py-2'>
                        <button onClick={handleLogout} className="hover:underline text-left w-full">Logout</button>
                      </li>
                    </ul>
                  </div>
                )}

              </div>
            </>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className='flex-1 flex items-center justify-center relative' style={{ backgroundImage:
       `url(${bgimage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className='absolute inset-0 bg-black/50'></div>
        <div className='relative z-10 flex flex-col items-center max-w-4xl mx-4 text-center space-y-6'>
          <img className='w-64 h-auto mb-4 shadow-lg' src={buksunew} alt="BUKSU Logo" />
          <p className='text-white text-xl md:text-2xl font-bold leading-relaxed px-4'>
            SSC Portal is an online platform that keeps students informed with the latest school updates and announcements. It also provides easy access to the student handbook for quick reference to school policies and guidelines.
          </p>
          <div className='flex flex-col sm:flex-row gap-4'>
            <button
              className='btn btn-primary px-8 py-3 text-lg font-semibold transition-all duration-300 transform hover:scale-105 rounded-lg'
              onClick={MemorandumClick}
            >
              Memorandum
            </button>
            <button
              className='btn btn-primary px-8 py-3 text-lg font-semibold transition-all duration-300 transform hover:scale-105 rounded-lg'
              onClick={HandbookClick}
            >
              Student Handbook
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Home
