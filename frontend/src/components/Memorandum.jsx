import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'


const Memorandum = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [memorandums, setMemorandums] = useState([])
  const { logout, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    fetchMemorandums()
  }, [])

  const fetchMemorandums = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/memorandums')
      const data = await response.json()
      setMemorandums(data)
    } catch (error) {
      console.error('Error fetching memorandums:', error)
    }
  }

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleViewPDF = (fileUrl) => {
    window.open(fileUrl, '_blank')
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
            <li className='py-2'><Link to="/memorandum" className="hover:underline">Memorandum</Link></li>

            <li className='py-2'><button onClick={handleLogout} className="hover:underline text-left w-full">Logout</button></li>
          </ul>
        </div>
      )}

      <main className='p-8'>
        <div className='max-w-4xl mx-auto'>
          <h1 className='text-3xl font-bold text-center mb-8 text-blue-950'>YEAR 2025 SCHOOL MEMOS</h1>
          <div className='space-y-4'>
            {memorandums.length > 0 ? (
              memorandums.map((memo) => (
                <div key={memo._id} className='bg-gray-100 p-4 rounded-lg shadow-md flex justify-between items-center'>
                  <div className='flex-1'>
                    <h2 className='text-xl font-semibold text-gray-800'>{memo.title}</h2>
                    <p className='text-sm text-gray-600'>Year: {memo.year}</p>
                  </div>
                  <button
                    onClick={() => handleViewPDF(memo.fileUrl)}
                    className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors'
                  >
                    View PDF
                  </button>
                </div>
              ))
            ) : (
              <p className='text-center text-gray-500'>No memorandums available yet.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default Memorandum
