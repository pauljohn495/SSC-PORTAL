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
      const response = await fetch('/api/memorandums')
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
        <div className='max-w-5xl mx-auto'>
          <h1 className='text-4xl font-bold text-center mb-12 text-blue-950'>BUKIDNON STATE UNIVERSITY MEMO</h1>
          
          {sortedYears.length > 0 ? (
            sortedYears.map((year) => (
              <div key={year} className='mb-12'>
                <h2 className='text-3xl font-bold text-center mb-8 text-blue-950'>YEAR {year} SCHOOL MEMOS</h2>
                <div className='space-y-4'>
                  {groupedMemorandums[year].map((memo, index) => (
                    <div key={memo._id} className='flex items-center space-x-4'>
                      <button
                        onClick={() => handleViewPDF(memo.fileUrl)}
                        className='bg-red-600 text-white px-6 py-3 rounded font-bold hover:bg-red-700 transition-colors text-sm whitespace-nowrap'
                      >
                        SCHOOL MEMO {index + 1}
                      </button>
                      <p className='text-black text-lg flex-1'>{memo.title}</p>
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
