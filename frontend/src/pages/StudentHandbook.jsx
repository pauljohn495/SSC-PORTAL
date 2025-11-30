import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationDropdown from '../components/NotificationDropdown'
import Swal from 'sweetalert2'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api'
const DRIVE_PREVIEW_BASE = 'https://drive.google.com/file/d'

GlobalWorkerOptions.workerSrc = pdfjsWorker

const StudentHandbook = () => {
  const [menuOpen, setMenuOpen] = useState(false)
  const [handbookPages, setHandbookPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [handbookError, setHandbookError] = useState('')
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [pdfSearchLoading, setPdfSearchLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [sectionSearchResults, setSectionSearchResults] = useState([])
  const [sectionSearchLoading, setSectionSearchLoading] = useState(false)
  const [sectionSearchError, setSectionSearchError] = useState('')
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1)
  const [isSearching, setIsSearching] = useState(false)
  const [viewerPage, setViewerPage] = useState(1)
  const [renderScale, setRenderScale] = useState(1)
  const [renderingPage, setRenderingPage] = useState(false)
  const [renderError, setRenderError] = useState('')
  const [containerWidth, setContainerWidth] = useState(0)
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 })
  const [sidebarSections, setSidebarSections] = useState([])
  const [sidebarLoading, setSidebarLoading] = useState(true)
  const [sidebarError, setSidebarError] = useState('')
  const [activeDocumentId, setActiveDocumentId] = useState(null)
  const pdfLoadingTaskRef = useRef(null)
  const renderTaskRef = useRef(null)
  const textLayerCacheRef = useRef(new Map())
  const pdfCacheRef = useRef(new Map()) // Cache for PDF ArrayBuffers
  const pdfDocCacheRef = useRef(new Map()) // Cache for loaded PDF documents
  const downloadMenuRef = useRef(null)
  const canvasRef = useRef(null)
  const canvasContainerRef = useRef(null)
  const authContext = useAuth()
  const logout = authContext?.logout
  const user = authContext?.user
  const authLoading = authContext?.loading ?? true
  const navigate = useNavigate()
  
  const resolveHandbookFileUrl = useCallback((handbook) => {
    if (!handbook) return ''
    if (handbook._id) {
      return `${API_BASE_URL}/handbook/${handbook._id}/file`
    }
    if (handbook.fileUrl) {
      if (handbook.fileUrl.startsWith('data:') || handbook.fileUrl.startsWith('http')) {
        return handbook.fileUrl
      }
      return `http://localhost:5001/${handbook.fileUrl}`
    }
    return ''
  }, [])

  const resolveViewerUrl = useCallback((handbook) => {
    if (!handbook) return ''
    if (handbook.googleDriveFileId) {
      return `${DRIVE_PREVIEW_BASE}/${handbook.googleDriveFileId}/preview`
    }
    if (handbook.googleDrivePreviewUrl) {
      return handbook.googleDrivePreviewUrl
    }
    if (handbook.fileUrl) {
      let absoluteUrl = handbook.fileUrl
      if (!handbook.fileUrl.startsWith('http') && !handbook.fileUrl.startsWith('https')) {
        absoluteUrl = `http://localhost:5001/${handbook.fileUrl}`
      }
      return `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(absoluteUrl)}`
    }
    return ''
  }, [])

  const resolveSectionFileUrl = useCallback((section) => {
    if (!section) return ''
    if (section._id) {
      return `${API_BASE_URL}/handbook-sections/${section._id}/file`
    }
    if (section.fileUrl) {
      if (section.fileUrl.startsWith('http')) {
        return section.fileUrl
      }
      return `http://localhost:5001/${section.fileUrl}`
    }
    return ''
  }, [])

  const resolveSectionViewerUrl = useCallback((section) => {
    if (!section) return ''
    if (section.googleDrivePreviewUrl) {
      return section.googleDrivePreviewUrl
    }
    const fileUrl = resolveSectionFileUrl(section)
    if (!fileUrl) return ''
    return `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(fileUrl)}`
  }, [resolveSectionFileUrl])

  // Get the current handbook (should be only one)
  const currentHandbook = handbookPages && Array.isArray(handbookPages) && handbookPages.length > 0 ? handbookPages[0] : null
  const documents = useMemo(() => {
    const docList = []
    if (currentHandbook) {
      docList.push({
        id: currentHandbook._id || 'handbook',
        title: currentHandbook.fileName || 'Student Handbook',
        description: 'Main handbook document',
        fileUrl: resolveHandbookFileUrl(currentHandbook),
        viewerUrl: resolveViewerUrl(currentHandbook),
        fileName: currentHandbook.fileName || 'Student-Handbook.pdf',
        type: 'handbook'
      })
    }
    if (Array.isArray(sidebarSections) && sidebarSections.length > 0) {
      sidebarSections.forEach((section) => {
        docList.push({
          id: `section-${section._id}`,
          title: section.title,
          description: section.description,
          fileUrl: resolveSectionFileUrl(section),
          viewerUrl: resolveSectionViewerUrl(section),
          fileName: section.fileName || `${section.title || 'Section'}.pdf`,
          type: 'section'
        })
      })
    }
    return docList
  }, [currentHandbook, sidebarSections, resolveHandbookFileUrl, resolveViewerUrl, resolveSectionFileUrl, resolveSectionViewerUrl])

  useEffect(() => {
    if (!documents.length) {
      setActiveDocumentId(null)
      return
    }
    if (!activeDocumentId || !documents.some((doc) => doc.id === activeDocumentId)) {
      const newDocId = documents[0].id
      setActiveDocumentId(newDocId)
      setViewerPage(1) // Reset to first page when setting new document
    }
  }, [documents, activeDocumentId])

  const activeDocument = useMemo(
    () => documents.find((doc) => doc.id === activeDocumentId) || null,
    [documents, activeDocumentId]
  )

  const handleSelectDocument = useCallback((docId) => {
    const prevDocId = activeDocumentId
    setActiveDocumentId((prev) => (prev === docId ? prev : docId))
    
    // Reset viewer page when switching documents
    if (prevDocId !== docId) {
      setViewerPage(1)
      setSearchResults([])
      setCurrentMatchIndex(-1)
      // Clear PDF caches when switching to ensure fresh content
      // Keep the cache but mark it for refresh
      setPdfArrayBuffer(null)
      setPdfDoc(null)
    }
    
    // Preload adjacent documents for faster switching
    const currentIndex = documents.findIndex(doc => doc.id === docId)
    if (currentIndex >= 0) {
      // Preload next document
      if (currentIndex + 1 < documents.length) {
        const nextDoc = documents[currentIndex + 1]
        if (nextDoc?.fileUrl && !pdfCacheRef.current.has(nextDoc.fileUrl)) {
          const preloadUrl = nextDoc.fileUrl.includes('?') 
            ? `${nextDoc.fileUrl}&t=${Date.now()}` 
            : `${nextDoc.fileUrl}?t=${Date.now()}`
          fetch(preloadUrl, { cache: 'no-cache' })
            .then(res => res.arrayBuffer())
            .then(buffer => {
              // Clone buffer before caching to prevent detachment issues
              const clonedBuffer = buffer.slice(0)
              pdfCacheRef.current.set(nextDoc.fileUrl, clonedBuffer)
            })
            .catch(err => console.warn('Failed to preload next document:', err))
        }
      }
      // Preload previous document
      if (currentIndex - 1 >= 0) {
        const prevDoc = documents[currentIndex - 1]
        if (prevDoc?.fileUrl && !pdfCacheRef.current.has(prevDoc.fileUrl)) {
          const preloadUrl = prevDoc.fileUrl.includes('?') 
            ? `${prevDoc.fileUrl}&t=${Date.now()}` 
            : `${prevDoc.fileUrl}?t=${Date.now()}`
          fetch(preloadUrl, { cache: 'no-cache' })
            .then(res => res.arrayBuffer())
            .then(buffer => {
              // Clone buffer before caching to prevent detachment issues
              const clonedBuffer = buffer.slice(0)
              pdfCacheRef.current.set(prevDoc.fileUrl, clonedBuffer)
            })
            .catch(err => console.warn('Failed to preload previous document:', err))
        }
      }
    }
  }, [documents, activeDocumentId])

  const searchFileUrl = activeDocument?.fileUrl || ''

  const viewerUrl = activeDocument?.viewerUrl || ''

  const viewerSrc = useMemo(() => {
    if (!viewerUrl) return ''
    if (!viewerPage) return viewerUrl
    const separator = viewerUrl.includes('?') ? '&' : '?'
    return `${viewerUrl}${separator}page=${viewerPage}`
  }, [viewerUrl, viewerPage])

  const currentMatch = useMemo(() => {
    if (currentMatchIndex < 0 || currentMatchIndex >= searchResults.length) return null
    return searchResults[currentMatchIndex]
  }, [currentMatchIndex, searchResults])

  const pageHighlights = useMemo(() => {
    if (!searchResults.length || !viewerPage) return []
    return searchResults.filter((match) => match.pageIndex === viewerPage - 1)
  }, [searchResults, viewerPage])

  const hasSearchTerm = Boolean(searchTerm.trim())

  // Fetch PDF ArrayBuffer for search (viewer streams directly from API)
  useEffect(() => {
    let isCancelled = false
    if (!searchFileUrl) {
      setPdfArrayBuffer(null)
      setPdfDoc(null)
      return
    }

    // Check cache first - clone the buffer to avoid detached ArrayBuffer errors
    const cachedBuffer = pdfCacheRef.current.get(searchFileUrl)
    if (cachedBuffer) {
      try {
        // Clone the ArrayBuffer to create a new, non-detached buffer
        const clonedBuffer = cachedBuffer.slice(0)
        setPdfArrayBuffer(clonedBuffer)
        setPdfSearchLoading(false)
        // For cached files, we can show viewer immediately
        return
      } catch (error) {
        // If cloning fails, remove from cache and fetch fresh
        console.warn('Failed to clone cached buffer, fetching fresh:', error)
        pdfCacheRef.current.delete(searchFileUrl)
      }
    }

    const fetchPdfData = async () => {
      try {
        setPdfSearchLoading(true)
        setHandbookError('')
        
        // For large PDFs, use streaming with PDF.js for faster initial load
        // PDF.js can start rendering before the entire file is downloaded
        const cacheBuster = `?t=${Date.now()}`
        const urlWithCacheBuster = searchFileUrl.includes('?') 
          ? `${searchFileUrl}&t=${Date.now()}` 
          : `${searchFileUrl}${cacheBuster}`
        
        // Use streaming fetch for better performance on large files
        // Use streaming fetch for better performance on large files
        // PDF.js can start processing while the file is still downloading
        const response = await fetch(urlWithCacheBuster, {
          cache: 'default', // Use browser cache for better performance
          headers: {
            'Accept': 'application/pdf'
          }
        })
        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.statusText}`)
        }
        
        // Use direct arrayBuffer() - browser handles optimization and streaming internally
        // This is faster than manual streaming for most cases due to browser optimizations
        const arrayBuffer = await response.arrayBuffer()
        if (isCancelled) return
        
        // Verify we got the right file by checking response headers
        const sectionId = response.headers.get('X-Section-Id')
        const fileName = response.headers.get('X-File-Name')
        if (sectionId && searchFileUrl.includes(sectionId)) {
          console.log(`Loaded PDF for section ${sectionId}: ${fileName}`)
        }
        
        // Clone the buffer before caching to prevent detachment issues
        const clonedBuffer = arrayBuffer.slice(0)
        // Cache the cloned buffer using the original URL (without cache buster)
        pdfCacheRef.current.set(searchFileUrl, clonedBuffer)
        setPdfArrayBuffer(clonedBuffer)
      } catch (error) {
        if (isCancelled) return
        console.error('Error fetching PDF:', error)
        setHandbookError(`Failed to load PDF: ${error.message}`)
        setPdfArrayBuffer(null)
      } finally {
        if (!isCancelled) {
          setPdfSearchLoading(false)
        }
      }
    }

    fetchPdfData()

    return () => {
      isCancelled = true
    }
  }, [searchFileUrl])

  // Define fetchHandbook using useCallback so it can be used in useEffect
  const fetchHandbook = useCallback(async () => {
    try {
      setLoading(true)
      setHandbookError('')
        const response = await fetch('http://localhost:5001/api/handbook')
      
      if (!response.ok) {
        throw new Error(`Failed to fetch handbook: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Fetched handbook data:', data) // Debug log
      
      // Ensure data is an array
      if (!Array.isArray(data)) {
        console.error('Expected array but got:', typeof data, data)
        setHandbookPages([])
        return
      }
      
      // Get the first approved handbook (should only be one now)
      const approvedHandbooks = data.filter(h => h.status === 'approved')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Get most recent
      
      console.log(`Found ${approvedHandbooks.length} approved handbook(s)`)
      
      setHandbookPages(approvedHandbooks)
    } catch (error) {
      console.error('Error fetching handbook:', error)
      setHandbookError(`Failed to load handbook: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchSidebarSections = useCallback(async () => {
    try {
      setSidebarLoading(true)
      setSidebarError('')
      const response = await fetch(`${API_BASE_URL}/handbook-sections`)
      if (!response.ok) {
        throw new Error(`Failed to fetch sections: ${response.statusText}`)
      }
      const data = await response.json()
      if (!Array.isArray(data)) {
        setSidebarSections([])
        return
      }
      setSidebarSections(data)
    } catch (error) {
      console.error('Error fetching sidebar sections:', error)
      setSidebarError('Failed to load handbook sidebar sections.')
      setSidebarSections([])
    } finally {
      setSidebarLoading(false)
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
      // Fetch in parallel for faster loading
      Promise.all([fetchHandbook(), fetchSidebarSections()]).catch(error => {
        console.error('Error fetching handbook data:', error);
      });
    }
  }, [user, fetchHandbook, fetchSidebarSections])

  useEffect(() => {
    let isCancelled = false
    textLayerCacheRef.current = new Map()
    setSearchResults([])
    setCurrentMatchIndex(-1)
    
    if (!pdfArrayBuffer || !searchFileUrl) {
      setPdfDoc(null)
      return
    }

    // Validate ArrayBuffer is not detached
    try {
      // Try to access the buffer to check if it's detached
      new Uint8Array(pdfArrayBuffer, 0, Math.min(4, pdfArrayBuffer.byteLength))
    } catch (error) {
      console.error('ArrayBuffer is detached, clearing cache and refetching:', error)
      pdfCacheRef.current.delete(searchFileUrl)
      pdfDocCacheRef.current.delete(searchFileUrl)
      setPdfArrayBuffer(null)
      setPdfDoc(null)
      return
    }

    // Check if we already have a loaded document for this URL
    const cachedDoc = pdfDocCacheRef.current.get(searchFileUrl)
    if (cachedDoc) {
      // Use cached document - no need to create a new loading task
      setPdfDoc(cachedDoc)
      return
    }

    // Always clone the buffer before passing to PDF.js to prevent detachment
    // PDF.js may transfer the buffer internally, making it detached for future use
    let bufferToUse
    try {
      bufferToUse = pdfArrayBuffer.slice(0)
    } catch (error) {
      console.error('Failed to clone buffer for PDF.js:', error)
      // If cloning fails, the buffer is likely already detached - clear cache and refetch
      pdfCacheRef.current.delete(searchFileUrl)
      pdfDocCacheRef.current.delete(searchFileUrl)
      setPdfArrayBuffer(null)
      setPdfDoc(null)
      return
    }

    // Optimize PDF.js configuration for better performance on large files
    const loadingTask = getDocument({ 
      data: bufferToUse,
      disableStream: false, // Enable streaming for large files
      disableAutoFetch: false, // Allow auto-fetching of required data
      useWorkerFetch: true // Use worker for better performance
    })
    pdfLoadingTaskRef.current = loadingTask

    loadingTask.promise
      .then((doc) => {
        if (isCancelled) {
          // If cancelled, destroy the document
          doc.destroy().catch(() => {})
          return
        }
        // Cache the loaded document
        pdfDocCacheRef.current.set(searchFileUrl, doc)
        setPdfDoc(doc)
        // Preload text content in background for faster searching
        preloadTextContent(doc).catch(err => {
          console.warn('Background text preload failed:', err)
        })
      })
      .catch((error) => {
        if (isCancelled) return
        console.error('Error loading PDF document:', error)
        // Only show error if it's not a cancellation
        if (error?.name !== 'AbortException' && error?.message !== 'Worker was destroyed') {
          setHandbookError((prev) => prev || `Failed to prepare PDF for search: ${error.message}`)
        }
        setPdfDoc(null)
        // Remove from cache if loading failed
        pdfCacheRef.current.delete(searchFileUrl)
        pdfDocCacheRef.current.delete(searchFileUrl)
      })

    return () => {
      isCancelled = true
      // Only destroy the loading task if it's still the current one and not completed
      if (loadingTask && pdfLoadingTaskRef.current === loadingTask) {
        // Don't destroy if the document is already cached (it means loading completed)
        const cachedDoc = pdfDocCacheRef.current.get(searchFileUrl)
        if (!cachedDoc) {
          // Only cancel if still loading
          try {
            loadingTask.destroy()
          } catch (error) {
            // Ignore destroy errors
          }
        }
        pdfLoadingTaskRef.current = null
      }
    }
  }, [pdfArrayBuffer, searchFileUrl])

  useEffect(() => {
    if (!searchResults.length) {
      setCurrentMatchIndex(-1)
      return
    }
    if (currentMatchIndex >= searchResults.length) {
      setCurrentMatchIndex(searchResults.length - 1)
    }
  }, [currentMatchIndex, searchResults])

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

  const toggleMenu = () => {
    setMenuOpen(!menuOpen)
  }

  const handleLogout = () => {
    if (logout) {
      logout()
    }
    navigate('/login')
  }

  const downloadActiveDocument = useCallback(async () => {
    if (!activeDocument) return
    const fileUrl = activeDocument.fileUrl

    if (!fileUrl) {
      Swal.fire({
        icon: 'warning',
        title: 'File Not Available',
        text: 'Document file not available for download',
        confirmButtonColor: '#2563eb'
      })
      return
    }

    try {
      setDownloadingPdf(true)
      const response = await fetch(fileUrl)
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()
      const pdfDocInstance = await PDFDocument.load(arrayBuffer)
      const font = await pdfDocInstance.embedFont(StandardFonts.Helvetica)
      const pages = pdfDocInstance.getPages()
      const downloadDate = new Date().toLocaleString()
      const leftText = `Downloaded: ${downloadDate}`
      const rightText = 'Bukidnon State University | Supreme Student Council'
      const fontSize = 7
      const margin = 36

      pages.forEach((page) => {
        const { width } = page.getSize()
        const rightTextWidth = font.widthOfTextAtSize(rightText, fontSize)
        const rightX = Math.max(margin, width - rightTextWidth - margin)
        const y = margin - 12

        page.drawText(leftText, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2)
        })

        page.drawText(rightText, {
          x: rightX,
          y,
          size: fontSize,
          font,
          color: rgb(0.2, 0.2, 0.2)
        })
      })

      const processedBytes = await pdfDocInstance.save()
      const blob = new Blob([processedBytes], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = activeDocument.fileName || `${activeDocument.title || 'Document'}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      setDownloadMenuOpen(false)
    } catch (error) {
      console.error('Download error:', error)
      Swal.fire({
        icon: 'error',
        title: 'Download Failed',
        text: error.message || 'Unable to download the document right now.',
        confirmButtonColor: '#dc2626'
      })
    } finally {
      setDownloadingPdf(false)
    }
  }, [activeDocument])

  // Preload all text content when PDF loads for faster searching
  const preloadTextContent = useCallback(async (doc) => {
    if (!doc) return
    
    // Check if already preloaded
    const firstPageCached = textLayerCacheRef.current.get(1)
    if (firstPageCached && textLayerCacheRef.current.size === doc.numPages) {
      return // Already preloaded
    }

    try {
      // Preload pages in batches for better performance
      const batchSize = 5
      const totalPages = doc.numPages
      
      for (let startPage = 1; startPage <= totalPages; startPage += batchSize) {
        const endPage = Math.min(startPage + batchSize - 1, totalPages)
        const pagePromises = []
        
        for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
          // Skip if already cached
          if (textLayerCacheRef.current.has(pageNumber)) continue
          
          pagePromises.push(
            doc.getPage(pageNumber)
              .then(page => Promise.all([
                page.getTextContent(),
                Promise.resolve(page.getViewport({ scale: 1 }))
              ]))
              .then(([textContent, viewport]) => {
                textLayerCacheRef.current.set(pageNumber, { items: textContent.items, viewport })
              })
              .catch(err => {
                console.warn(`Failed to preload page ${pageNumber}:`, err)
              })
          )
        }
        
        await Promise.all(pagePromises)
      }
    } catch (error) {
      console.warn('Error preloading text content:', error)
    }
  }, [])

  const performSearch = useCallback(async () => {
    if (!pdfDoc) {
      setSearchResults([])
      setCurrentMatchIndex(-1)
      return
    }

    const keyword = searchTerm.trim()
    if (!keyword) {
      setSearchResults([])
      setCurrentMatchIndex(-1)
      return
    }

    setIsSearching(true)

    try {
      const normalizedKeyword = keyword.toLowerCase()
      const pendingResults = []
      
      // Use cached text content for faster search
      // Process pages in batches and update results progressively for better UX
      const batchSize = 10 // Process 10 pages at a time
      const totalPages = pdfDoc.numPages
      
      for (let startPage = 1; startPage <= totalPages; startPage += batchSize) {
        const endPage = Math.min(startPage + batchSize - 1, totalPages)
        
        // Process batch of pages
        for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
          let cacheEntry = textLayerCacheRef.current.get(pageNumber)
          
          if (!cacheEntry) {
            // Load on demand if not cached
            const page = await pdfDoc.getPage(pageNumber)
            const textContent = await page.getTextContent()
            const viewport = page.getViewport({ scale: 1 })
            cacheEntry = { items: textContent.items, viewport }
            textLayerCacheRef.current.set(pageNumber, cacheEntry)
          }
          
          // Process this page
          processPageForSearch(cacheEntry, pageNumber, normalizedKeyword, pendingResults)
        }
        
        // Update results progressively (show results as they're found)
        if (pendingResults.length > 0) {
          setSearchResults([...pendingResults])
          if (pendingResults.length === 1) {
            setCurrentMatchIndex(0)
          }
        }
        
        // Small delay to allow UI to update and prevent blocking
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Final update with all results
      setSearchResults(pendingResults)
      setCurrentMatchIndex(pendingResults.length ? 0 : -1)
    } catch (error) {
      console.error('Error searching PDF:', error)
      setHandbookError((prev) => prev || `Search failed: ${error.message}`)
    } finally {
      setIsSearching(false)
    }
  }, [pdfDoc, searchTerm, preloadTextContent])

  // Helper function to process a page for search (extracted for reusability)
  const processPageForSearch = useCallback((cacheEntry, pageNumber, normalizedKeyword, pendingResults) => {
    const { items, viewport } = cacheEntry

    items.forEach((item, itemIndex) => {
      if (!item?.str) return
      const text = item.str
      const lowerText = text.toLowerCase()
      if (!lowerText.includes(normalizedKeyword)) return

      const baseTransform = item.transform || [1, 0, 0, 1, 0, 0]
      const baseWidth = (item.width || 0) / viewport.width
      const baseHeight = Math.abs(item.height || baseTransform[3] || 0) / viewport.height
      const originX = (baseTransform[4] || 0) / viewport.width
      const baselineY = (baseTransform[5] || 0) / viewport.height
      const topFromTop = 1 - baselineY
      const normalizedHeight = Math.max(baseHeight, 0.008)

      let startIndex = 0
      const safeLength = text.length || normalizedKeyword.length

      while (startIndex <= lowerText.length) {
        const foundIndex = lowerText.indexOf(normalizedKeyword, startIndex)
        if (foundIndex === -1) break

        const proportion = safeLength ? foundIndex / safeLength : 0
        const widthRatio = safeLength ? normalizedKeyword.length / safeLength : 1
        const normalizedWidth = Math.max(baseWidth * widthRatio, 0.01)
        const normalizedLeft = originX + baseWidth * proportion
        const normalizedTop = Math.max(topFromTop - normalizedHeight, 0)

        pendingResults.push({
          id: `${pageNumber}-${itemIndex}-${foundIndex}`,
          pageIndex: pageNumber - 1,
          rect: {
            x: normalizedLeft,
            y: normalizedTop,
            width: normalizedWidth,
            height: normalizedHeight
          },
          snippet: text.trim() || text
        })

        startIndex = foundIndex + normalizedKeyword.length
      }
    })
  }, [])

  const handleSearchSubmit = useCallback((event) => {
    event.preventDefault()
    performSearch()
  }, [performSearch])

  const handleClearSearch = useCallback(() => {
    setSearchTerm('')
    setSearchResults([])
    setCurrentMatchIndex(-1)
    setSectionSearchResults([])
    setSectionSearchError('')
  }, [])

  const goToMatch = useCallback((direction) => {
    if (!searchResults.length) return
    setCurrentMatchIndex((prev) => {
      if (prev === -1) return 0
      const nextIndex = (prev + direction + searchResults.length) % searchResults.length
      return nextIndex
    })
  }, [searchResults])

  const goToPageManually = useCallback((direction) => {
    if (!pdfDoc) return
    setViewerPage((prev) => {
      const next = prev + direction
      if (next < 1 || next > pdfDoc.numPages) {
        return prev
      }
      return next
    })
  }, [pdfDoc])

  const handleZoomIn = useCallback(() => {
    setRenderScale((prev) => Math.min(prev + 0.2, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setRenderScale((prev) => Math.max(prev - 0.2, 0.4))
  }, [])

  const handleZoomReset = useCallback(() => {
    setRenderScale(1)
  }, [])

  useEffect(() => {
    if (!activeDocument?.id) {
      setViewerPage(1)
      return
    }
    textLayerCacheRef.current = new Map()
    setSearchResults([])
    setCurrentMatchIndex(-1)
      setViewerPage(1)
  }, [activeDocument?.id])

  useEffect(() => {
    if (currentMatchIndex < 0 || currentMatchIndex >= searchResults.length) {
      return
    }

    const activeMatch = searchResults[currentMatchIndex]
    const targetPageNumber = activeMatch.pageIndex + 1
    setViewerPage(targetPageNumber)
  }, [currentMatchIndex, searchResults])

  useEffect(() => {
    if (!pdfDoc) return
    setViewerPage((prev) => {
      const nextPage = prev || 1
      const clamped = Math.min(Math.max(nextPage, 1), pdfDoc.numPages)
      return clamped
    })
  }, [pdfDoc])
  // Preload text content when PDF loads for faster searching
  useEffect(() => {
    if (!pdfDoc) return
    // Preload text content in background (non-blocking)
    preloadTextContent(pdfDoc).catch(err => {
      console.warn('Background text preload failed:', err)
    })
  }, [pdfDoc, preloadTextContent])

  // Debounced search for better performance (avoids searching on every keystroke)
  useEffect(() => {
    if (!pdfDoc) {
      setSearchResults([])
      setCurrentMatchIndex(-1)
      return
    }
    if (!searchTerm.trim()) {
      setSearchResults([])
      setCurrentMatchIndex(-1)
      return
    }

    const timeoutId = setTimeout(() => {
      performSearch()
    }, 300) // 300ms debounce - waits for user to stop typing

    return () => {
      clearTimeout(timeoutId)
    }
  }, [pdfDoc, performSearch, searchTerm])

  useEffect(() => {
    const query = searchTerm.trim()
    if (!query) {
      setSectionSearchResults([])
      setSectionSearchError('')
      setSectionSearchLoading(false)
      return
    }

    const controller = new AbortController()
    let cancelled = false
    const timeoutId = setTimeout(async () => {
      try {
        setSectionSearchLoading(true)
        setSectionSearchError('')
        const response = await fetch(
          `${API_BASE_URL}/handbook-sections/search?query=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        )
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.message || 'Failed to search sections')
        }
        const data = await response.json()
        if (cancelled) {
          return
        }
        const results = Array.isArray(data.results) ? data.results : []
        setSectionSearchResults(results)
      } catch (error) {
        if (cancelled || error.name === 'AbortError') {
          return
        }
        console.error('Error searching other sections:', error)
        setSectionSearchResults([])
        setSectionSearchError(error.message || 'Failed to search other sections.')
      } finally {
        if (!cancelled) {
          setSectionSearchLoading(false)
        }
      }
    }, 400)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [searchTerm])

  useEffect(() => {
    const element = canvasContainerRef.current
    if (!element) return
    const updateSize = () => {
      setContainerWidth(element.clientWidth || 0)
    }
    updateSize()
    let resizeObserver = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateSize)
      resizeObserver.observe(element)
    }
    window.addEventListener('resize', updateSize)
    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      window.removeEventListener('resize', updateSize)
    }
  }, [pdfDoc, activeDocument?.id])

  useEffect(() => {
    if (!pdfDoc || !viewerPage || !canvasRef.current) return
    let isCancelled = false
    const cancelCurrentRender = async () => {
      if (renderTaskRef.current) {
        const task = renderTaskRef.current
        try {
          task.cancel()
        } catch {}
        try {
          await task.promise
        } catch (err) {
          if (err?.name !== 'RenderingCancelledException') {
            throw err
          }
        }
        if (renderTaskRef.current === task) {
          renderTaskRef.current = null
        }
      }
    }
    const renderPage = async () => {
      setRenderingPage(true)
      setRenderError('')
      let currentTask = null
      try {
        await cancelCurrentRender()
        
        // Check if cancelled or document destroyed
        if (isCancelled || !pdfDoc || pdfDoc.destroyed) {
          return
        }
        
        const safePage = Math.min(Math.max(viewerPage, 1), pdfDoc.numPages)
        if (safePage !== viewerPage) {
          setViewerPage(safePage)
          return
        }
        
        // Check again after potential state update
        if (isCancelled || !pdfDoc || pdfDoc.destroyed) {
          return
        }
        
        const page = await pdfDoc.getPage(safePage)
        const baseViewport = page.getViewport({ scale: 1 })
        const widthToUse = containerWidth || baseViewport.width
        const scale = Math.max((widthToUse / baseViewport.width) * renderScale, 0.2)
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        if (!canvas) {
          throw new Error('Canvas element not available')
        }
        // Final check before rendering
        if (isCancelled || !pdfDoc || pdfDoc.destroyed || !canvas) {
          return
        }
        
        const context = canvas.getContext('2d')
        canvas.width = viewport.width
        canvas.height = viewport.height
        context.clearRect(0, 0, canvas.width, canvas.height)
        
        currentTask = page.render({ canvasContext: context, viewport })
        renderTaskRef.current = currentTask
        await currentTask.promise
        if (!isCancelled) {
          setCanvasDimensions({ width: viewport.width, height: viewport.height })
        }
      } catch (error) {
        if (!isCancelled && error?.name !== 'RenderingCancelledException') {
          // Don't show error if document was destroyed (normal when switching)
          const errorMessage = error?.message || ''
          if (errorMessage.includes('destroyed') || 
              errorMessage.includes('Worker was destroyed') ||
              errorMessage.includes('sendWithPromise') ||
              errorMessage.includes('Cannot read properties of null')) {
            // Document was destroyed, likely due to switching - this is expected
            return
          }
          console.error('Error rendering PDF page:', error)
          setRenderError('Failed to render handbook page.')
        }
      } finally {
        if (currentTask && renderTaskRef.current === currentTask) {
          renderTaskRef.current = null
        }
        if (!isCancelled) {
          setRenderingPage(false)
        }
      }
    }
    renderPage()
    return () => {
      isCancelled = true
      cancelCurrentRender().catch(() => {})
    }
  }, [pdfDoc, viewerPage, renderScale, containerWidth])

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

  return (
    <div className='bg-white min-h-screen'>
      {/* Header */}
      <header className='bg-blue-950 text-white p-2 sm:p-4 flex justify-between items-center min-h-[64px]'>
        <div className='flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0'>
          <Link to="/" className='flex items-center space-x-1 sm:space-x-4 flex-shrink-0'>
            <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='h-8 sm:h-12 md:h-16 w-auto' />
            <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='h-8 sm:h-12 md:h-16 w-auto hidden sm:block' />
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
              onClick={() => navigate('/admin-dashboard')}
            >
              <span className='hidden sm:inline'>Admin Dashboard</span>
              <span className='sm:hidden'>Admin</span>
            </button>
          )}
          {user && <NotificationDropdown />}
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
                  <li className='px-4 py-2'><button onClick={() => { handleLogout(); setMenuOpen(false); }} className="hover:underline text-left w-full">Logout</button></li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className='p-4 sm:p-6 md:p-8'>
        <div className='max-w-6xl mx-auto relative'>
          <div className='flex justify-between items-center mb-4 sm:mb-6'>
            <div className='flex-1'></div>
            <h1 className='text-xl sm:text-2xl md:text-3xl font-bold text-center flex-1 text-blue-950'>STUDENT HANDBOOK</h1>
            {/* Download Button */}
            {!loading && activeDocument ? (
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
                      onClick={downloadActiveDocument}
                      disabled={downloadingPdf}
                      className={`block w-full text-left px-4 py-3 rounded-lg text-black transition ${
                        downloadingPdf ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'hover:bg-gray-100'
                      }`}
                    >
                      {downloadingPdf ? 'Preparing download…' : 'Download PDF'}
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
          ) : documents.length === 0 ? (
            <div className='text-center py-12'>
              <p className='text-gray-500 text-lg mb-2'>
                No handbook content available yet.
              </p>
            </div>
          ) : (
            <div className='flex flex-col lg:flex-row gap-6'>
              <aside className='w-full lg:w-64 space-y-4'>
                <div className='bg-white border border-gray-200 rounded-lg shadow-sm p-4'>
                  <div className='flex items-center justify-between mb-3'>
                    <h2 className='text-base font-semibold text-blue-950'>Handbook Sections</h2>
                    {sidebarLoading && <span className='text-xs text-gray-400'>Loading...</span>}
                  </div>
                  {sidebarError && (
                    <p className='text-xs text-red-500 mb-2'>{sidebarError}</p>
                  )}
                  <div className='space-y-2 max-h-[60vh] overflow-y-auto'>
                    {documents.map((doc) => {
                      const isActive = doc.id === activeDocument?.id
                      return (
                        <button
                          type='button'
                          key={doc.id}
                          onClick={() => handleSelectDocument(doc.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition ${
                            isActive
                              ? 'border-blue-600 bg-blue-50 text-blue-900'
                              : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 text-gray-700'
                          }`}
                        >
                          <div className='flex items-center justify-between'>
                            <span className='font-semibold'>{doc.title}</span>
                            {doc.type === 'handbook' && (
                              <span className='text-[10px] uppercase font-semibold text-blue-600'>Main</span>
                            )}
                          </div>
                          {doc.description && (
                            <p className='text-xs text-gray-500 mt-1 line-clamp-2'>{doc.description}</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </aside>
              <div className='flex-1 min-w-0 space-y-6'>
                {handbookError && (
                  <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg'>
                    {handbookError}
                  </div>
                )}

                {activeDocument && (
                  <div className='bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex flex-col gap-1'>
                    <p className='text-xs uppercase text-gray-500 tracking-wide'>Active Document</p>
                    <h2 className='text-2xl font-semibold text-blue-950'>{activeDocument.title}</h2>
                    {activeDocument.description && (
                      <p className='text-sm text-gray-600'>{activeDocument.description}</p>
                    )}
                  </div>
                )}

                {pdfDoc && (
                  <div className='bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4'>
                    <form onSubmit={handleSearchSubmit} className='flex flex-col gap-3 lg:flex-row lg:items-center'>
                      <input
                        type='text'
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder='Search inside the current document...'
                        className='flex-1 rounded-lg border border-gray-300 px-4 py-2 text-black focus:outline-none focus:ring-2 focus:ring-blue-500'
                        disabled={!pdfDoc || pdfSearchLoading}
                      />
                      <div className='flex gap-2'>
                        <button
                          type='submit'
                          className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300'
                          disabled={!pdfDoc || pdfSearchLoading || isSearching || !searchTerm.trim()}
                        >
                          {isSearching ? 'Searching...' : 'Search'}
                        </button>
                        <button
                          type='button'
                          onClick={handleClearSearch}
                          className='px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition disabled:bg-gray-50'
                          disabled={!searchTerm && !searchResults.length}
                        >
                          Clear
                        </button>
                      </div>
                    </form>

                    <div className='flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600'>
                      <span className='text-xs text-gray-500'>
                        {pdfSearchLoading ? 'Preparing search index...' : pdfDoc ? 'Search ready' : 'Search unavailable'}
                      </span>
                      <span className='font-semibold text-gray-700'>
                        {searchResults.length > 0
                          ? `Match ${currentMatchIndex + 1} of ${searchResults.length}`
                          : 'No matches yet'}
                      </span>
                      <div className='flex gap-2'>
                        <button
                          type='button'
                          onClick={() => goToMatch(-1)}
                          className='px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 transition disabled:bg-gray-50 disabled:text-gray-400'
                          disabled={searchResults.length === 0}
                        >
                          Prev
                        </button>
                        <button
                          type='button'
                          onClick={() => goToMatch(1)}
                          className='px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 transition disabled:bg-gray-50 disabled:text-gray-400'
                          disabled={searchResults.length === 0}
                        >
                          Next
                        </button>
                      </div>
                    </div>

                    {searchResults.length > 0 && (
                      <div className='max-h-48 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100'>
                        {searchResults.map((match, index) => (
                          <button
                            type='button'
                            key={match.id}
                            onClick={() => setCurrentMatchIndex(index)}
                            className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition ${
                              currentMatchIndex === index ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className='flex items-center justify-between text-xs font-semibold text-gray-700'>
                              <span>Page {match.pageIndex + 1}</span>
                              {currentMatchIndex === index && <span className='text-blue-600'>Active</span>}
                            </div>
                            <p className='text-xs text-gray-500 truncate'>
                              {match.snippet?.length > 120 ? `${match.snippet.slice(0, 117)}...` : match.snippet}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {hasSearchTerm && (
                  <div className='bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3'>
                    <div className='flex flex-wrap items-start justify-between gap-2'>
                      <div>
                        <p className='text-sm font-semibold text-blue-950'>Matches in other sections</p>
                        <p className='text-xs text-gray-500'>Click a result to open that section.</p>
                      </div>
                      <div className='text-xs text-gray-500'>
                        {sectionSearchLoading
                          ? 'Searching…'
                          : `${sectionSearchResults.length} section${
                              sectionSearchResults.length === 1 ? '' : 's'
                            }`}
                      </div>
                    </div>
                    {sectionSearchError && (
                      <div className='text-xs text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2'>
                        {sectionSearchError}
                      </div>
                    )}
                    {!sectionSearchError &&
                      (sectionSearchResults.length > 0 ? (
                        <div className='max-h-60 overflow-y-auto border border-gray-100 rounded-lg divide-y divide-gray-100'>
                          {sectionSearchResults.map((result) => (
                            <button
                              type='button'
                              key={result.sectionId}
                              onClick={() => handleSelectDocument(`section-${result.sectionId}`)}
                              className='w-full text-left px-3 py-3 hover:bg-blue-50 transition'
                            >
                              <div className='flex items-center justify-between text-sm font-semibold text-gray-800'>
                                <span>{result.title}</span>
                                <span className='text-xs text-gray-500'>
                                  {(result.snippets?.length || 0).toString()} match
                                  {result.snippets?.length === 1 ? '' : 'es'}
                                </span>
                              </div>
                              {result.description && (
                                <p className='text-xs text-gray-500 mt-1 line-clamp-1'>
                                  {result.description}
                                </p>
                              )}
                              <div className='mt-2 space-y-1'>
                                {(result.snippets || []).slice(0, 3).map((snippet, index) => (
                                  <p
                                    key={`${result.sectionId}-${index}`}
                                    className='text-xs text-gray-600 line-clamp-2'
                                  >
                                    …{snippet.text}…
                                  </p>
                                ))}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        !sectionSearchLoading && (
                          <p className='text-sm text-gray-500'>
                            No matches found in other sections yet.
                          </p>
                        )
                      ))}
                  </div>
                )}

                {pdfDoc ? (
                  <div className='bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden'>
                    <div className='flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 text-sm text-gray-700'>
                      <div className='flex flex-col gap-1'>
                        <p className='font-semibold text-gray-800'>
                          Page {viewerPage} of {pdfDoc?.numPages || '?'}
                        </p>
                        <p className='text-xs text-gray-500'>Use the controls to move between pages.</p>
                      </div>
                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => goToPageManually(-1)}
                          className='px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 transition disabled:bg-gray-50 disabled:text-gray-400'
                          disabled={viewerPage <= 1}
                        >
                          Prev Page
                        </button>
                        <button
                          type='button'
                          onClick={() => goToPageManually(1)}
                          className='px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 transition disabled:bg-gray-50 disabled:text-gray-400'
                          disabled={viewerPage >= (pdfDoc?.numPages || viewerPage)}
                        >
                          Next Page
                        </button>
                      </div>
                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={handleZoomOut}
                          className='px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition'
                        >
                          -
                        </button>
                        <span className='min-w-[48px] text-center font-semibold'>
                          {Math.round(renderScale * 100)}%
                        </span>
                        <button
                          type='button'
                          onClick={handleZoomIn}
                          className='px-2 py-1 rounded border border-gray-300 hover:bg-gray-100 transition'
                        >
                          +
                        </button>
                        <button
                          type='button'
                          onClick={handleZoomReset}
                          className='px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 transition text-sm'
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                    <div
                      ref={canvasContainerRef}
                      className='bg-gray-50 flex justify-center overflow-auto p-4 min-h-[400px] w-full max-w-full'
                    >
                      <div className='relative inline-block shadow-lg rounded max-w-full'>
                        <canvas ref={canvasRef} className='bg-white rounded block' />
                        {canvasDimensions.width > 0 &&
                          pageHighlights.map((highlight) => {
                            const isActive = currentMatch?.id === highlight.id
                            const width = canvasDimensions.width || 1
                            const height = canvasDimensions.height || 1
                            const style = {
                              left: `${Math.max(0, (highlight.rect?.x || 0) * width)}px`,
                              top: `${Math.max(0, (highlight.rect?.y || 0) * height)}px`,
                              width: `${Math.max(0, (highlight.rect?.width || 0) * width)}px`,
                              height: `${Math.max(0, (highlight.rect?.height || 0) * height)}px`
                            }
                            return (
                              <div
                                key={highlight.id}
                                className={`absolute border ${
                                  isActive
                                    ? 'bg-blue-500/30 border-blue-500'
                                    : 'bg-yellow-300/30 border-yellow-400'
                                } pointer-events-none rounded-sm`}
                                style={style}
                              />
                            )
                          })}
                      </div>
                    </div>
                    {renderingPage && (
                      <p className='text-center text-xs text-gray-500 pb-4'>Rendering page...</p>
                    )}
                  </div>
                ) : searchFileUrl ? (
                  <div className='bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden min-h-[400px]'>
                    {/* Show iframe viewer immediately for faster perceived load time */}
                    {viewerUrl ? (
                      <div className='w-full h-[80vh]'>
                        <iframe
                          key={`${activeDocumentId}-preview-${viewerUrl}`}
                          src={viewerUrl}
                          title='PDF Preview'
                          className='w-full h-full border-0'
                          allowFullScreen
                          loading='eager'
                        />
                        {pdfSearchLoading && (
                          <div className='absolute top-4 right-4 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm flex items-center space-x-2'>
                            <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white'></div>
                            <span>Loading search index...</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className='flex items-center justify-center h-full'>
                        <div className='flex items-center space-x-3'>
                          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
                          <p className='text-gray-500 text-sm'>Preparing handbook viewer...</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : viewerUrl ? (
                  <div className='bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden min-h-[600px] relative'>
                    {!viewerSrc && (
                      <div className='absolute inset-0 flex items-center justify-center bg-gray-50'>
                        <p className='text-gray-500 text-sm'>Loading PDF viewer...</p>
                      </div>
                    )}
                    <iframe
                      key={`${activeDocumentId}-${viewerUrl}`}
                      src={viewerSrc || undefined}
                      title='Student Handbook Viewer'
                      className='w-full h-[80vh]'
                      allowFullScreen
                      loading='eager'
                      style={{ display: viewerSrc ? 'block' : 'none' }}
                      onLoad={() => {
                        // Ensure iframe is visible after load
                        setRenderError('')
                      }}
                      onError={() => {
                        setRenderError('Failed to load PDF viewer')
                      }}
                    />
                  </div>
                ) : currentHandbook?.content ? (
                  <div className='bg-white rounded-lg shadow-md p-8 prose max-w-none'>
                    <div className='text-gray-700 leading-relaxed whitespace-pre-wrap text-base'>
                      {currentHandbook.content}
                    </div>
                  </div>
                ) : (
                  <div className='text-center py-12 text-gray-500'>
                    No handbook content available.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

    </div>
  )
}

export default StudentHandbook

