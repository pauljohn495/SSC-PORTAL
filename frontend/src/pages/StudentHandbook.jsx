import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationDropdown from '../components/NotificationDropdown'
import jsPDF from 'jspdf'

const StudentHandbook = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [handbookPages, setHandbookPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [pendingPage, setPendingPage] = useState(null)
  const [pdfError, setPdfError] = useState(null)
  const [pdfLoaded, setPdfLoaded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const downloadMenuRef = useRef(null)
  const pdfIframeRef = useRef(null)
  const { logout, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Define fetchHandbook using useCallback so it can be used in useEffect
  const fetchHandbook = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:5001/api/handbook')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch handbook: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Fetched handbook data:', data) // Debug log
      
      // Get all approved handbook pages, sorted by pageNumber
      const approvedPages = data.filter(h => h.status === 'approved')
        .sort((a, b) => {
          // Sort by pageNumber if available, otherwise by creation date
          if (a.pageNumber && b.pageNumber) {
            return a.pageNumber - b.pageNumber
          }
          return new Date(a.createdAt) - new Date(b.createdAt)
        })
      
      console.log(`Found ${approvedPages.length} approved handbook pages`)
      
      setHandbookPages(approvedPages)
    } catch (error) {
      console.error('Error fetching handbook:', error)
      setPdfError(`Failed to load handbook: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login')
    }
  }, [user, authLoading, navigate])

  useEffect(() => {
    if (user) {
      fetchHandbook()
    }
  }, [user, fetchHandbook])

  // For single handbook, no need to sort by pageNumber
  const sortedPages = handbookPages
  const currentPage = sortedPages[currentPageIndex]
  const totalPages = sortedPages.length

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.has('page')) {
      const pageValue = Number(params.get('page'))
      if (!Number.isNaN(pageValue) && pageValue > 0) {
        setPendingPage(pageValue)
        // Find the index of the page with this pageNumber
        const pageIndex = sortedPages.findIndex(p => p.pageNumber === pageValue)
        if (pageIndex !== -1) {
          setCurrentPageIndex(pageIndex)
        }
      }
    }
  }, [location.search, sortedPages])

  // Reset PDF loaded state when page changes
  useEffect(() => {
    setPdfLoaded(false)
  }, [currentPage?._id])

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

  useEffect(() => {
    if (pendingPage == null || sortedPages.length === 0) return

    const targetIndex = sortedPages.findIndex((page, index) => {
      const pageNumber = page.pageNumber || index + 1
      return Number(pageNumber) === Number(pendingPage)
    })

    if (targetIndex >= 0) {
      setCurrentPageIndex(targetIndex)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setPendingPage(null)
  }, [pendingPage, sortedPages])

  // Show loading or nothing while checking auth
  if (authLoading) {
    return (
      <div className='bg-white min-h-screen flex items-center justify-center'>
        <p className='text-gray-500'>Loading...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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

  const handleSearch = () => {
    if (!searchQuery.trim() || sortedPages.length === 0) return

    const query = searchQuery.toLowerCase().trim()
    
    // Search through pdfContent of all pages
    for (let i = 0; i < sortedPages.length; i++) {
      const page = sortedPages[i]
      const content = (page.pdfContent || page.content || '').toLowerCase()
      
      if (content.includes(query)) {
        // Found the term in this page, navigate to it
        goToPage(i)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
    }
    
    // If not found, show a message (you could use a toast here)
    alert(`No results found for "${searchQuery}"`)
  }

  const downloadCurrentPageAsPDF = async () => {
    if (!currentPage || !currentPage._id) return

    try {
      // Get the current page number
      const currentPageNum = currentPage.pageNumber || currentPageIndex + 1
      const url = `http://localhost:5001/api/handbook/${currentPage._id}/download-page?page=${currentPageNum}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        // Try to parse as JSON for error message
        let errorMessage = 'Failed to download page'
        try {
          const errorData = await response.json()
          errorMessage = errorData.message || errorMessage
        } catch (e) {
          // If not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        alert(errorMessage)
        return
      }

      // Check if response is actually a PDF
      const contentType = response.headers.get('Content-Type')
      if (!contentType || !contentType.includes('application/pdf')) {
        alert('Invalid response format. Expected PDF file.')
        return
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = currentPage.fileName || 'handbook.pdf'
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i)
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '')
        }
      } else {
        // Generate filename based on current page
        const baseName = currentPage.fileName ? currentPage.fileName.replace('.pdf', '') : 'handbook'
        filename = `${baseName}-page-${currentPageNum}.pdf`
      }

      // Create blob and download with explicit PDF type
      const blob = await response.blob()
      
      // Ensure blob has correct MIME type
      const pdfBlob = blob.type === 'application/pdf' 
        ? blob 
        : new Blob([blob], { type: 'application/pdf' })
      
      // Verify blob is not empty
      if (pdfBlob.size === 0) {
        alert('Downloaded file is empty or invalid.')
        return
      }

      const link = document.createElement('a')
      link.href = URL.createObjectURL(pdfBlob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      // Clean up the object URL after a short delay
      setTimeout(() => {
        URL.revokeObjectURL(link.href)
      }, 100)

      setDownloadMenuOpen(false)
    } catch (error) {
      console.error('Error downloading page:', error)
      alert('Failed to download page. Please try again.')
    }
  }


  const downloadFullHandbook = () => {
    if (!currentPage) return

    // If PDF file exists, download it directly (full handbook)
    if (currentPage.fileUrl) {
      const link = document.createElement('a')
      // Handle both base64 data URLs and file paths
      const fileUrl = currentPage.fileUrl.startsWith('data:') || currentPage.fileUrl.startsWith('http')
        ? currentPage.fileUrl
        : `http://localhost:5001/${currentPage.fileUrl}`
      link.href = fileUrl
      link.download = currentPage.fileName || `Student-Handbook.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setDownloadMenuOpen(false)
      return
    }

    // Fallback to generating PDF from text content (for backward compatibility)
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const footerHeight = 15
    const maxWidth = pageWidth - 2 * margin
    const lineHeight = 7
    let yPosition = margin
    let pageNumber = 1

    // Helper function to add footer
    const addFooter = (pageNum) => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const footerY = pageHeight - footerHeight
      doc.text(`Page ${pageNum}`, pageWidth / 2, footerY, { align: 'center' })
    }

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
    yPosition += 15

    // Split content into lines that fit the page width
    const content = currentPage.content || ''
    const lines = doc.splitTextToSize(content, maxWidth)

    // Add content
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    
    lines.forEach((line) => {
      if (yPosition + lineHeight > pageHeight - margin - footerHeight) {
        // Add footer to current page before adding new page
        addFooter(pageNumber)
        doc.addPage()
        pageNumber++
        yPosition = margin
      }
      doc.text(line, margin, yPosition)
      yPosition += lineHeight
    })

    // Add footer to the last page
    addFooter(pageNumber)

    doc.save(`Student-Handbook-Page-${currentPage.pageNumber || currentPageIndex + 1}.pdf`)
    setDownloadMenuOpen(false)
  }

  const downloadAllPagesAsPDF = () => {
    if (sortedPages.length === 0) return

    // Check if all pages have PDF files
    const allHavePDFs = sortedPages.every(page => page.fileUrl)
    
    if (allHavePDFs) {
      // For now, download the first page as a workaround
      // In a production system, you might want to merge PDFs on the server
      const firstPage = sortedPages[0]
      const link = document.createElement('a')
      link.href = firstPage.fileUrl
      link.download = firstPage.fileName || 'Student-Handbook-Page-1.pdf'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setDownloadMenuOpen(false)
      alert('Note: Downloading first page. Full PDF merging will be available soon.')
      return
    }

    // Fallback to generating PDF from text content (for backward compatibility)
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 20
    const footerHeight = 15
    const maxWidth = pageWidth - 2 * margin
    const lineHeight = 7
    let totalPageNumber = 1

    // Helper function to add footer
    const addFooter = (pageNum) => {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const footerY = pageHeight - footerHeight
      doc.text(`Page ${pageNum}`, pageWidth / 2, footerY, { align: 'center' })
    }

    sortedPages.forEach((page, index) => {
      if (index > 0) {
        // Add footer to previous page before adding new page
        addFooter(totalPageNumber - 1)
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
      yPosition += 15

      // Split content into lines
      const content = page.content || ''
      const lines = doc.splitTextToSize(content, maxWidth)

      // Add content
      doc.setFontSize(11)
      lines.forEach((line) => {
        if (yPosition + lineHeight > pageHeight - margin - footerHeight) {
          // Add footer to current page before adding new page
          addFooter(totalPageNumber)
          doc.addPage()
          totalPageNumber++
          yPosition = margin
        }
        doc.text(line, margin, yPosition)
        yPosition += lineHeight
      })
    })

    // Add footer to the last page
    addFooter(totalPageNumber)

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
          {/* Search Bar */}
          <div className='mb-6'>
            <div className='relative'>
              <input
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch()
                  }
                }}
                placeholder='Search handbook by keywords...'
                className='w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
              />
              <svg
                className='absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
              </svg>
              <button
                onClick={handleSearch}
                className='absolute right-4 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors'
              >
                Search
              </button>
            </div>
          </div>

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
                      onClick={downloadFullHandbook}
                      className='block w-full text-left px-4 py-3 hover:bg-gray-100 transition rounded-b-lg border-t border-gray-200 text-black'
                    >
                      Download Full Handbook
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className='flex-1'></div>
            )}
          </div>
          

          {loading ? (
            <p className='text-center text-gray-500'>Loading...</p>
          ) : totalPages === 0 ? (
            <div className='text-center py-12'>
              <p className='text-gray-500 text-lg mb-2'>
                No handbook content available yet.
              </p>
            </div>
          ) : (
            <>
              {/* Handbook Display */}
              <div className='bg-gray-100 p-8 rounded-lg shadow-md min-h-[400px] mb-6'>
                {currentPage?.fileUrl ? (
                  <div className='w-full' style={{ minHeight: '800px' }}>
                    {pdfError ? (
                      <div className='text-center py-12 bg-red-50 rounded-lg'>
                        <p className='text-red-600 mb-4'>Error loading PDF: {pdfError}</p>
                        <button
                          onClick={() => {
                            setPdfError(null)
                            if (pdfIframeRef.current) {
                              const baseUrl = currentPage.fileUrl.startsWith('data:') || currentPage.fileUrl.startsWith('http') 
                                ? currentPage.fileUrl 
                                : `http://localhost:5001/${currentPage.fileUrl}`
                              pdfIframeRef.current.src = baseUrl
                            }
                          }}
                          className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700'
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <iframe
                        ref={pdfIframeRef}
                        src={(() => {
                          const baseUrl = currentPage.fileUrl.startsWith('data:') || currentPage.fileUrl.startsWith('http') 
                            ? currentPage.fileUrl 
                            : `http://localhost:5001/${currentPage.fileUrl}`
                          
                          console.log('Loading PDF from:', baseUrl) // Debug log
                          return baseUrl
                        })()}
                        className='w-full h-full border-0 rounded-lg'
                        style={{ minHeight: '800px', height: '100vh' }}
                        title={currentPage.fileName || 'Student Handbook'}
                        onError={() => {
                          console.error('PDF iframe error')
                          setPdfError('Failed to load PDF. Please check if the file exists.')
                        }}
                        onLoad={() => {
                          console.log('PDF iframe loaded successfully')
                          setPdfError(null)
                          setPdfLoaded(true)
                        }}
                      />
                    )}
                  </div>
                ) : currentPage?.content ? (
                  <div className='prose max-w-none'>
                    <div className='text-gray-700 leading-relaxed whitespace-pre-wrap text-base'>
                      {currentPage.content}
                    </div>
                  </div>
                ) : (
                  <div className='text-center py-12 text-gray-500'>
                    No handbook content available.
                  </div>
                )}
              </div>

              {/* Pagination Controls - Only show if multiple handbooks (backward compatibility) */}
              {totalPages > 1 && (
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
                      Page {currentPage?.pageNumber || currentPageIndex + 1} of {totalPages}
                    </span>
                    
                    <button
                      onClick={goToNext}
                      disabled={currentPageIndex === totalPages - 1}
                      className='px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      Next
                    </button>
                  </div>

                  {/* Page Number Buttons - Show only 10 at a time */}
                  <div className='flex flex-wrap justify-center gap-2 max-w-2xl items-center'>
                    {/* Calculate which 10 pages to show */}
                    {(() => {
                      const pagesPerView = 10
                      const currentPageNum = currentPage?.pageNumber || currentPageIndex + 1
                      
                      // Calculate the start page of the current window
                      // If on page 11, we want to show pages 11-20
                      const windowStart = Math.floor((currentPageNum - 1) / pagesPerView) * pagesPerView + 1
                      const windowEnd = Math.min(windowStart + pagesPerView - 1, totalPages)
                      
                      // Find the indices for pages in this window
                      const visiblePages = sortedPages.filter((page, index) => {
                        const pageNum = page.pageNumber || index + 1
                        return pageNum >= windowStart && pageNum <= windowEnd
                      })
                      
                      return (
                        <>
                          {/* Show "..." if there are pages before the current window */}
                          {windowStart > 1 && (
                            <>
                              <button
                                onClick={() => {
                                  const firstPageIndex = sortedPages.findIndex(p => (p.pageNumber || sortedPages.indexOf(p) + 1) === 1)
                                  if (firstPageIndex !== -1) goToPage(firstPageIndex)
                                }}
                                className='px-3 py-2 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors'
                                title='Go to page 1'
                              >
                                1
                              </button>
                              {windowStart > 2 && (
                                <span className='text-gray-500 px-2'>...</span>
                              )}
                            </>
                          )}
                          
                          {/* Show the 10 visible page numbers */}
                          {visiblePages.map((page, idx) => {
                            const pageIndex = sortedPages.findIndex(p => p._id === page._id)
                            const pageNum = page.pageNumber || pageIndex + 1
                            return (
                              <button
                                key={page._id}
                                onClick={() => goToPage(pageIndex)}
                                className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                                  pageIndex === currentPageIndex
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                                title={`Go to page ${pageNum}`}
                              >
                                {pageNum}
                              </button>
                            )
                          })}
                          
                          {/* Show "..." if there are pages after the current window */}
                          {windowEnd < totalPages && (
                            <>
                              {windowEnd < totalPages - 1 && (
                                <span className='text-gray-500 px-2'>...</span>
                              )}
                              <button
                                onClick={() => {
                                  const lastPageIndex = sortedPages.findIndex(p => {
                                    const pageNum = p.pageNumber || sortedPages.indexOf(p) + 1
                                    return pageNum === totalPages
                                  })
                                  if (lastPageIndex !== -1) goToPage(lastPageIndex)
                                }}
                                className='px-3 py-2 rounded-lg font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors'
                                title={`Go to page ${totalPages}`}
                              >
                                {totalPages}
                              </button>
                            </>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

    </div>
  )
}

export default StudentHandbook
