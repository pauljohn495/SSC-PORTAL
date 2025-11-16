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
  const [showPageInput, setShowPageInput] = useState(false)
  const [pageInput, setPageInput] = useState('')
  const [pdfError, setPdfError] = useState(null)
  const [pdfLoaded, setPdfLoaded] = useState(false)
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
      
      // Get the approved handbook (should be only one now)
      const approvedHandbook = data.find(h => h.status === 'approved') || data[0]
      
      if (approvedHandbook) {
        console.log('Approved handbook found:', approvedHandbook) // Debug log
        console.log('Handbook fileUrl:', approvedHandbook.fileUrl) // Debug log
      } else {
        console.log('No approved handbook found') // Debug log
      }
      
      // Set as single handbook or array for backward compatibility
      setHandbookPages(approvedHandbook ? [approvedHandbook] : [])
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

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.has('page')) {
      const pageValue = Number(params.get('page'))
      if (!Number.isNaN(pageValue)) {
        setPendingPage(pageValue)
      }
    }
  }, [location.search])

  // For single handbook, no need to sort by pageNumber
  const sortedPages = handbookPages
  const currentPage = sortedPages[currentPageIndex]
  const totalPages = sortedPages.length

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

  const downloadCurrentPageAsPDF = () => {
    if (!currentPage) return
    setShowPageInput(true)
    setDownloadMenuOpen(false)
  }

  const handleDownloadPage = async () => {
    if (!currentPage || !currentPage._id) return

    try {
      const pageParam = pageInput.trim()
      const url = `http://localhost:5001/api/handbook/${currentPage._id}/download-page${pageParam ? `?page=${encodeURIComponent(pageParam)}` : ''}`
      
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

      setShowPageInput(false)
      setPageInput('')
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
                      Download Specific Page(s)
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
              )}
            </>
          )}
        </div>
      </main>

      {/* Page Input Modal */}
      {showPageInput && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50' onClick={() => setShowPageInput(false)}>
          <div className='bg-white rounded-lg p-6 w-full max-w-md' onClick={(e) => e.stopPropagation()}>
            <h2 className='text-2xl font-bold mb-4 text-blue-950'>Download Page(s)</h2>
            <p className='text-sm text-gray-600 mb-4'>
              Enter the page number(s) you want to download:
            </p>
            <ul className='text-xs text-gray-500 mb-4 list-disc list-inside space-y-1'>
              <li>Single page: <strong>5</strong></li>
              <li>Multiple pages: <strong>1,3,5</strong></li>
              <li>Page range: <strong>1-5</strong></li>
              <li>Leave empty to download all pages</li>
            </ul>
            <input
              type='text'
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              placeholder='e.g., 5 or 1-5 or 1,3,5'
              className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black mb-4'
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleDownloadPage()
                }
              }}
            />
            <div className='flex space-x-4'>
              <button
                onClick={handleDownloadPage}
                className='flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors'
              >
                Download
              </button>
              <button
                onClick={() => {
                  setShowPageInput(false)
                  setPageInput('')
                }}
                className='flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg font-semibold transition-colors'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StudentHandbook
