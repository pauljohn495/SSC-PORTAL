import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import NotificationDropdown from '../components/NotificationDropdown'

const Search = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('memorandum')
  const [yearFilter, setYearFilter] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)

  const toggleMenu = () => setMenuOpen((prev) => !prev)

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    navigate('/login')
  }

  const performSearch = useCallback(async (searchQuery, overriddenType, overriddenYear) => {
    if (!searchQuery.trim()) {
      setError('Please enter a search term.')
      setResults([])
      setSearched(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      params.set('q', searchQuery.trim())
      params.set('role', user?.role || 'student')
      const effectiveType = overriddenType ?? typeFilter
      const effectiveYear = overriddenYear ?? yearFilter
      if (effectiveType && effectiveType !== 'all') {
        params.set('type', effectiveType)
      }
      if (effectiveYear) {
        params.set('year', effectiveYear)
      }

      const response = await fetch(`/api/search?${params.toString()}`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || 'Failed to search')
      }

      const data = await response.json()
      setResults(data.results || [])
      setSearched(true)
    } catch (err) {
      console.error('Search error:', err)
      setError(err.message || 'Search failed. Please try again later.')
      setResults([])
      setSearched(true)
    } finally {
      setLoading(false)
    }
  }, [typeFilter, yearFilter, user?.role])

  const handleSearch = async (event) => {
    event.preventDefault()
    await performSearch(query, typeFilter, yearFilter)
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const initialQuery = params.get('q') || ''
    const initialType = params.get('type') || 'memorandum'
    const initialYear = params.get('year') || ''

    let shouldTriggerSearch = false

    if (initialQuery && initialQuery !== query) {
      setQuery(initialQuery)
      shouldTriggerSearch = true
    }
    if (initialType !== typeFilter) {
      setTypeFilter(initialType)
      shouldTriggerSearch = true
    }
    if (initialYear !== yearFilter) {
      setYearFilter(initialYear)
      shouldTriggerSearch = true
    }

    if (initialQuery && shouldTriggerSearch) {
      performSearch(initialQuery, initialType, initialYear)
    }
  }, [location.search, performSearch])

  const handleResultClick = (item) => {
    if (item.type === 'memorandum') {
      const params = new URLSearchParams()
      params.set('memoId', item.id)
      navigate(`/memorandum?${params.toString()}`)
      return
    }
  }

  return (
    <div className='bg-white min-h-screen'>
      <header className='bg-blue-950 text-white p-4 flex justify-between items-center' style={{ height: '64px' }}>
        <div className='flex items-center space-x-4' style={{ height: '100%' }}>
          <Link to='/' className='flex items-center space-x-4'>
            <img src='/src/assets/buksu-white.png' alt='BUKSU White Logo' style={{ maxHeight: '128px', width: 'auto' }} />
            <img src='/src/assets/ssc-logo.png' alt='SSC Logo' style={{ maxHeight: '128px', width: 'auto' }} />
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
          {user && user.role === 'president' && (
            <button
              className='bg-white text-blue-950 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition cursor-pointer'
              onClick={() => navigate('/president-dashboard')}
            >
              President Dashboard
            </button>
          )}
          {user && <NotificationDropdown />}
          <button
            className='text-white hover:bg-blue-900 p-2 rounded-lg transition cursor-pointer'
            onClick={toggleMenu}
            aria-label='Menu'
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
            <li className='py-2'><Link to='/' className='hover:underline'>Home</Link></li>
            <li className='py-2'><Link to='/student-handbook' className='hover:underline'>Handbook</Link></li>
            <li className='py-2'><Link to='/memorandum' className='hover:underline'>Memorandum</Link></li>
            <li className='py-2'><Link to='/search' className='hover:underline'>Search</Link></li>
            <li className='py-2'><Link to='/buksu-calendar' className='hover:underline'>BUKSU Calendar</Link></li>
            <li className='py-2'><button onClick={handleLogout} className='hover:underline text-left w-full'>Logout</button></li>
          </ul>
        </div>
      )}

      <main className='p-6 md:p-10 bg-gray-50 min-h-[calc(100vh-64px)]'>
        <div className='max-w-5xl mx-auto bg-white rounded-lg shadow p-6'>
          <h1 className='text-2xl font-bold text-blue-950 mb-4'>Search Memorandums</h1>

          <form onSubmit={handleSearch} className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
            <div className='md:col-span-2'>
              <label className='block text-sm font-semibold text-gray-700 mb-2'>Search</label>
              <input
                type='text'
                placeholder='Enter keyword or phrase'
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black'
              />
            </div>

            <div className='md:col-span-4 flex justify-end items-end'>
              <button
                type='submit'
                className='bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition'
                disabled={loading}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {error && (
            <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4'>
              {error}
            </div>
          )}

          {searched && !loading && results.length === 0 && !error && (
            <div className='text-gray-600 text-center py-10'>
              No results found. Try different keywords or filters.
            </div>
          )}

          {results.length > 0 && (
            <ul className='space-y-4'>
              {results.map((item) => (
                <li key={item.id}>
                  <button
                    type='button'
                    onClick={() => handleResultClick(item)}
                    className='w-full text-left border border-gray-200 rounded-lg p-4 hover:shadow-md transition bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <div className='flex items-center justify-between mb-2'>
                      <span className='uppercase text-xs font-semibold tracking-wider text-blue-700'>
                        {item.type}
                      </span>
                      <span className='text-xs text-gray-500'>
                        {item.type === 'memorandum' && item.year ? `Year ${item.year}` : ''}
                      </span>
                    </div>
                    <h2
                      className='text-lg font-semibold text-blue-950 mb-2'
                      dangerouslySetInnerHTML={{ __html: item.titleSnippet || item.title }}
                    ></h2>
                    {item.snippet && (
                      <p
                        className='text-sm text-gray-700 leading-relaxed'
                        dangerouslySetInnerHTML={{ __html: `${item.snippet}` }}
                      ></p>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}

export default Search


