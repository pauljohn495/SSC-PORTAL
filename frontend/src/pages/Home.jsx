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
  const [homeSearch, setHomeSearch] = useState('')
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

  const handleHomeSearch = (event) => {
    event.preventDefault()
    if (!homeSearch.trim()) {
      return
    }

    const params = new URLSearchParams()
    params.set('q', homeSearch.trim())
    params.set('type', 'memorandum')
    navigate(`/search?${params.toString()}`)
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
                      <li className='px-4 py-2'><Link to="/search" className="hover:underline">Search</Link></li>
                      <li className='px-4 py-2'><Link to="/buksu-calendar" className="hover:underline">BUKSU Calendar</Link></li>
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
        </section>

        <section className='bg-white py-16'>
          <div className='max-w-6xl mx-auto px-6'>
            <div className='bg-white rounded-xl shadow-2xl p-8 text-blue-950'>
              <h2 className='text-2xl font-bold mb-6'>Search Handbooks & Memorandums</h2>
              <form onSubmit={handleHomeSearch} className='grid grid-cols-1 md:grid-cols-4 gap-6'>
                <div className='md:col-span-2'>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>Search</label>
                  <input
                    type='text'
                    value={homeSearch}
                    onChange={(e) => setHomeSearch(e.target.value)}
                    placeholder='Enter keyword or phrase'
                    className='w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
                  />
                </div>
                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>Type</label>
                  <div className='px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-700 flex items-center'>
                    All
                  </div>
                </div>
                <div>
                  <label className='block text-sm font-semibold text-gray-700 mb-2'>Year</label>
                  <div className='px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-400'>Optional</div>
                </div>
                <div className='md:col-span-4 flex justify-end'>
                  <button
                    type='submit'
                    className='bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition'
                  >
                    Search
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className='bg-blue-950 text-white py-10'>
        <div className='max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left'>
          <div>
            <p className='text-lg font-semibold'>Bukidnon State University - Supreme Student Council</p>
            <p className='text-sm text-blue-200'>Empowering students through information and service.</p>
          </div>
          <div className='text-sm text-blue-200'>
            © {new Date().getFullYear()} BUKSU SSC. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home
