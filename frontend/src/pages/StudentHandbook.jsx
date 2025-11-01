import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationIcon from '../components/NotificationIcon'

const StudentHandbook = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [handbookPages, setHandbookPages] = useState([])
  const [loading, setLoading] = useState(true)
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchHandbook()
  }, [])

  const fetchHandbook = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/handbook')
      const data = await response.json()
      setHandbookPages(data)
    } catch (error) {
      console.error('Error fetching handbook:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className='bg-white min-h-screen'>
      {/* Header */}
      <header className='bg-blue-950 text-white p-4 flex justify-between items-center' style={{ height: '64px' }}>
        <div className='flex items-center space-x-4' style={{ height: '100%' }}>
          <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" style={{ maxHeight: '128px', width: 'auto' }} />
          <img src="/src/assets/ssc-logo.png" alt="SSC Logo" style={{ maxHeight: '128px', width: 'auto' }} />
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
          <NotificationIcon />
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

            <li className='py-2'><button onClick={handleLogout} className="hover:underline text-left w-full">Logout</button></li>
          </ul>
        </div>
      )}

      {/* Main Content */}
      <main className='p-8'>
        <div className='max-w-4xl mx-auto'>
          <h1 className='text-3xl font-bold text-center mb-8 text-blue-950'>STUDENT HANDBOOK</h1>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className='space-y-6'>
              {handbookPages.length > 0 ? (
                handbookPages.map((page) => (
                  <div key={page._id} className='bg-gray-100 p-6 rounded-lg shadow-md'>
                    <h2 className='text-2xl font-semibold text-gray-800 mb-4'>{page.title}</h2>
                    <div className='prose max-w-none'>
                      <pre className='whitespace-pre-wrap text-gray-700 leading-relaxed'>{page.content}</pre>
                    </div>
                  </div>
                ))
              ) : (
                <p className='text-center text-gray-500'>No handbook content available yet.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default StudentHandbook
