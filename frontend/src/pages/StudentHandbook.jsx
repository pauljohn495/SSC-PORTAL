import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationDropdown from '../components/NotificationDropdown'
import jsPDF from 'jspdf'

const StudentHandbook = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [handbookPages, setHandbookPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const downloadMenuRef = useRef(null)
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

  // Filter pages based on search query
  const filteredPages = handbookPages.filter(page => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return page.content.toLowerCase().includes(query)
  })

  // Sort filtered pages by pageNumber
  const sortedPages = [...filteredPages].sort((a, b) => {
    const pageNumA = a.pageNumber || 0
    const pageNumB = b.pageNumber || 0
    return pageNumA - pageNumB
  })

  // Ensure current page index is valid after filtering
  useEffect(() => {
    if (currentPageIndex >= sortedPages.length && sortedPages.length > 0) {
      setCurrentPageIndex(sortedPages.length - 1)
    } else if (sortedPages.length === 0) {
      setCurrentPageIndex(0)
    }
  }, [sortedPages.length, currentPageIndex])

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

  const currentPage = sortedPages[currentPageIndex]
  const totalPages = sortedPages.length

  const goToPage = (index) => {
    if (index >= 0 && index < totalPages) {
      setCurrentPageIndex(index)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToPrevious = () => {
    if (currentPageIndex > 0) {
      goToPage(currentPageIndex - 1)
    }
  }

  const goToNext = () => {
    if (currentPageIndex < totalPages - 1) {
      goToPage(currentPageIndex + 1)
    }
  }

  const downloadCurrentPageAsPDF = () => {
    if (!currentPage) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const maxWidth = pageWidth - 2 * margin
    const lineHeight = 7
    let yPosition = margin

    // Add header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('BUKIDNON STATE UNIVERSITY', pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 8
    doc.setFontSize(14)
    doc.text('SUPREME STUDENT COUNCIL', pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10
    doc.setFontSize(16)
    doc.text('STUDENT HANDBOOK', pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(`Page ${currentPage.pageNumber || currentPageIndex + 1}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 15

    // Split content into lines that fit the page width
    const content = currentPage.content
    const lines = doc.splitTextToSize(content, maxWidth)

    // Add content
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    
    lines.forEach((line) => {
      if (yPosition + lineHeight > pageHeight - margin) {
        doc.addPage()
        yPosition = margin
      }
      doc.text(line, margin, yPosition)
      yPosition += lineHeight
    })

    doc.save(`Student-Handbook-Page-${currentPage.pageNumber || currentPageIndex + 1}.pdf`)
    setDownloadMenuOpen(false)
  }

  const downloadAllPagesAsPDF = () => {
    if (sortedPages.length === 0) return

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const maxWidth = pageWidth - 2 * margin
    const lineHeight = 7

    sortedPages.forEach((page, index) => {
      if (index > 0) {
        doc.addPage()
      }

      let yPosition = margin

      // Add header
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('BUKIDNON STATE UNIVERSITY', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 8
      doc.setFontSize(14)
      doc.text('SUPREME STUDENT COUNCIL', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 10
      doc.setFontSize(16)
      doc.text('STUDENT HANDBOOK', pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 10
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(`Page ${page.pageNumber || index + 1}`, pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 15

      // Split content into lines
      const content = page.content
      const lines = doc.splitTextToSize(content, maxWidth)

      // Add content
      doc.setFontSize(11)
      lines.forEach((line) => {
        if (yPosition + lineHeight > pageHeight - margin) {
          doc.addPage()
          yPosition = margin
        }
        doc.text(line, margin, yPosition)
        yPosition += lineHeight
      })
    })

    doc.save('Student-Handbook-All-Pages.pdf')
    setDownloadMenuOpen(false)
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
            {!loading && totalPages > 0 ? (
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
                      onClick={downloadCurrentPageAsPDF}
                      className='block w-full text-left px-4 py-3 hover:bg-gray-100 transition rounded-t-lg text-black'
                    >
                      Download This Page
                    </button>
                    <button
                      onClick={downloadAllPagesAsPDF}
                      className='block w-full text-left px-4 py-3 hover:bg-gray-100 transition rounded-b-lg border-t border-gray-200 text-black'
                    >
                      Download All Pages
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className='flex-1'></div>
            )}
          </div>
          
          {/* Search Bar */}
          <div className='mb-6'>
            <input
              type='text'
              placeholder='Search handbook content...'
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPageIndex(0) // Reset to first page when searching
              }}
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
            />
            {searchQuery && (
              <p className='text-sm text-gray-600 mt-2'>
                Found {totalPages} page{totalPages !== 1 ? 's' : ''} matching "{searchQuery}"
              </p>
            )}
          </div>

          {loading ? (
            <p className='text-center text-gray-500'>Loading...</p>
          ) : totalPages === 0 ? (
            <div className='text-center py-12'>
              <p className='text-gray-500 text-lg mb-2'>
                {searchQuery ? 'No pages found matching your search.' : 'No handbook content available yet.'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className='text-blue-600 hover:text-blue-800 underline'
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Current Page Display */}
              <div className='bg-gray-100 p-8 rounded-lg shadow-md min-h-[400px] mb-6'>
                <div className='prose max-w-none'>
                  <div className='text-gray-700 leading-relaxed whitespace-pre-wrap text-base'>
                    {currentPage.content}
                  </div>
                </div>
              </div>

              {/* Pagination Controls */}
              <div className='flex flex-col items-center space-y-4'>
                {/* Page Navigation Buttons */}
                <div className='flex items-center space-x-4'>
                  <button
                    onClick={goToPrevious}
                    disabled={currentPageIndex === 0}
                    className='px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    Previous
                  </button>
                  
                  <span className='text-gray-700 font-medium'>
                    Page {currentPageIndex + 1} of {totalPages}
                  </span>
                  
                  <button
                    onClick={goToNext}
                    disabled={currentPageIndex === totalPages - 1}
                    className='px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                  >
                    Next
                  </button>
                </div>

                {/* Page Number Buttons */}
                <div className='flex flex-wrap justify-center gap-2 max-w-2xl'>
                  {sortedPages.map((page, index) => (
                    <button
                      key={page._id}
                      onClick={() => goToPage(index)}
                      className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                        index === currentPageIndex
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      title={`Go to page ${page.pageNumber || index + 1}`}
                    >
                      {page.pageNumber || index + 1}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default StudentHandbook
