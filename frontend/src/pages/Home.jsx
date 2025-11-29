import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationDropdown from '../components/NotificationDropdown'
import ProfileSetupModal from '../components/ProfileSetupModal'
import { authAPI } from '../services/api'
import bgimage from '../assets/bg-image.jpg'
import buksunew from '../assets/buksu-new.png'
const Home = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const navigate = useNavigate()
  const { user, logout, loading: authLoading, updateUser } = useAuth()

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (!authLoading && user && user.role === 'student' && !user.profileCompleted) {
      setShowProfileModal(true)
    } else {
      setShowProfileModal(false)
    }
  }, [authLoading, user])

  useEffect(() => {
    if (showProfileModal) {
      setProfileError('')
    }
  }, [showProfileModal])

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const MemorandumClick = () => {
    navigate('/memorandum')
  }

  const HandbookClick = () => {
    navigate('/student-handbook')
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

  const handleProfileSubmit = async ({ department, course }) => {
    if (!user?._id) {
      return
    }

    try {
      setProfileError('')
      setIsSavingProfile(true)
      const response = await authAPI.updateProfile(user._id, { department, course })
      if (response?.user) {
        updateUser(response.user)
      }
      setShowProfileModal(false)
    } catch (error) {
      setProfileError(error.message || 'Failed to save your information. Please try again.')
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleProfileCancel = () => {
    handleLogout()
  }

  // Show loading or nothing while checking auth
  if (authLoading || !user) {
    return null
  }

  return (
    <div className='s text-black w-full min-h-screen flex flex-col'>
      {user.role === 'student' && (
        <ProfileSetupModal
          isOpen={showProfileModal}
          onSubmit={handleProfileSubmit}
          onCancel={handleProfileCancel}
          isSaving={isSavingProfile}
          errorMessage={profileError}
        />
      )}

      {/* Header */}
      <header className='bg-blue-950 text-white p-2 sm:p-4 flex justify-between items-center min-h-[64px]'>
        <div className='flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0'>
          <Link to="/" className='flex items-center space-x-1 sm:space-x-4 flex-shrink-0'>
            <img 
              src="/src/assets/buksu-white.png" 
              alt="BUKSU White Logo" 
              className='h-8 sm:h-12 md:h-16 w-auto' 
            />
            <img 
              src="/src/assets/ssc-logo.png" 
              alt="SSC Logo" 
              className='h-8 sm:h-12 md:h-16 w-auto hidden sm:block' 
            />
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
              onClick={AdminDashboardClick}
            >
              <span className='hidden sm:inline'>Admin Dashboard</span>
              <span className='sm:hidden'>Admin</span>
            </button>
          )}
          {user && user.role === 'president' && (
            <button
              className='bg-white text-blue-950 px-2 sm:px-4 py-1 sm:py-2 rounded-lg text-xs sm:text-sm md:text-base font-semibold hover:bg-gray-200 transition cursor-pointer whitespace-nowrap'
              onClick={PresidentDashboardClick}
            >
              <span className='hidden sm:inline'>President Dashboard</span>
              <span className='sm:hidden'>President</span>
            </button>
          )}
          {user && (
            <>
              <NotificationDropdown />
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
      <main className='flex-1'>
        <section className='relative flex items-center justify-center py-24 md:py-32 min-h-[88vh]' style={{ backgroundImage:
         `url(${bgimage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
          <div className='absolute inset-0 bg-black/50'></div>
          <div className='relative z-10 flex flex-col items-center max-w-4xl mx-4 text-center space-y-4 sm:space-y-6'>
            <img className='w-48 sm:w-64 h-auto mb-2 sm:mb-4 shadow-lg' src={buksunew} alt="BUKSU Logo" />
            <p className='text-white text-base sm:text-xl md:text-2xl font-bold leading-relaxed px-2 sm:px-4'>
              SSC Portal is an online platform that keeps students informed with the latest school updates and announcements. It also provides easy access to the student handbook for quick reference to school policies and guidelines.
            </p>
            <div className='flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto'>
              <button
                className='btn btn-primary px-6 sm:px-8 py-2 sm:py-3 text-base sm:text-lg font-semibold transition-all duration-300 transform hover:scale-105 rounded-lg w-full sm:w-auto'
                onClick={MemorandumClick}
              >
                Memorandum
              </button>
              <button
                className='btn btn-primary px-6 sm:px-8 py-2 sm:py-3 text-base sm:text-lg font-semibold transition-all duration-300 transform hover:scale-105 rounded-lg w-full sm:w-auto'
                onClick={HandbookClick}
              >
                Student Handbook
              </button>
            </div>
          </div>
        </section>

      </main>

      <footer className='bg-blue-950 text-white py-6 sm:py-10'>
        <div className='max-w-6xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4 text-center md:text-left'>
          <div>
            <p className='text-sm sm:text-base md:text-lg font-semibold'>Bukidnon State University - Supreme Student Council</p>
            <p className='text-xs sm:text-sm text-blue-200 mt-1'>Empowering students through information and service.</p>
          </div>
          <div className='text-xs sm:text-sm text-blue-200'>
            © {new Date().getFullYear()} BUKSU SSC. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home
