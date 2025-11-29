import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { logApiResponse } from '../utils/fetchWithLogging'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import Swal from 'sweetalert2'

// Helper function to format date as ISO string with local time (no timezone conversion)
// The timezone will be specified separately to Google Calendar
const toLocalISOString = (date) => {
  if (!date) return ''
  const pad = (num) => (num < 10 ? '0' : '') + num
  
  const year = date.getFullYear()
  const month = pad(date.getMonth() + 1)
  const day = pad(date.getDate())
  const hours24 = pad(date.getHours())
  const mins = pad(date.getMinutes())
  const secs = pad(date.getSeconds())
  
  // Format as local time without timezone offset
  // Google Calendar will interpret this in the timezone we specify
  return `${year}-${month}-${day}T${hours24}:${mins}:${secs}`
}

// Get user's timezone name (e.g., "Asia/Manila")
const getUserTimezone = () => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}

// Format event date/time for display in user's local timezone
const formatEventDateTime = (dateTimeString) => {
  if (!dateTimeString) return ''
  const date = new Date(dateTimeString)
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date)
}

const PresidentCalendar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [archivedEvents, setArchivedEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ summary: '', description: '', startISO: '', endISO: '', location: '' })
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [error, setError] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!user || user.role !== 'president') {
      navigate('/')
      return
    }
    fetchEvents()
    fetchArchivedEvents()
  }, [user])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/president/calendar/events?userId=${user._id}`)
      logApiResponse(res);
      if (res.status === 409) return // not connected yet
      const data = await res.json()
      if (Array.isArray(data)) {
        setEvents(data)
      } else if (Array.isArray(data?.events)) {
        setEvents(data.events)
      } else {
        setEvents([])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchArchivedEvents = async () => {
    try {
      const res = await fetch(`/api/president/calendar/events/archived?userId=${user._id}`)
      logApiResponse(res);
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setArchivedEvents(data)
        } else if (Array.isArray(data?.events)) {
          setArchivedEvents(data.events)
        } else {
          setArchivedEvents([])
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  const connectGoogle = async () => {
    const res = await fetch(`/api/president/calendar/auth-url?userId=${user._id}`)
    logApiResponse(res);
    const { url } = await res.json()
    window.open(url, '_blank', 'width=500,height=700')
  }

  const createEvent = async (e) => {
    e.preventDefault()
    try {
      setError(null)
      const body = { 
        ...form, 
        userId: user._id,
        timeZone: getUserTimezone() // Send user's timezone to backend
      }
      const res = await fetch('/api/president/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      logApiResponse(res);
      
      if (res.ok) {
        // Success - clear form and refresh events
        // Don't need to parse response body for success case
        setForm({ summary: '', description: '', startISO: '', endISO: '', location: '' })
        setStartDate(null)
        setEndDate(null)
        fetchEvents()
      } else {
        // Handle error response - safely parse JSON
        const contentType = res.headers.get('content-type')
        const isJson = contentType && contentType.includes('application/json')
        
        if (isJson) {
          const text = await res.text()
          if (text.trim()) {
            try {
              const data = JSON.parse(text)
              setError(data.message || 'Failed to create event')
            } catch (parseError) {
              setError(`Failed to create event (${res.status}): Invalid response from server`)
            }
          } else {
            setError(`Failed to create event (${res.status}): Empty response from server`)
          }
        } else {
          setError(`Failed to create event (${res.status}): Server returned an error`)
        }
      }
    } catch (e) {
      setError('Failed to create event: ' + e.message)
    }
  }

  const handleArchiveClick = async (eventId, eventTitle) => {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Archive Event',
      text: `Are you sure you want to archive "${eventTitle || 'this event'}"?`,
      showCancelButton: true,
      confirmButtonColor: '#f97316',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, archive it'
    });
    if (!result.isConfirmed) {
      return;
    }
    try {
      setError(null)
      const res = await fetch(`/api/president/calendar/events/${eventId}/archive?userId=${user._id}`, { method: 'PUT' })
      logApiResponse(res);
      if (res.ok) {
        fetchEvents()
        fetchArchivedEvents()
      } else {
        // Handle error response - safely parse JSON
        const contentType = res.headers.get('content-type')
        const isJson = contentType && contentType.includes('application/json')

        if (isJson) {
          const text = await res.text()
          if (text.trim()) {
            try {
              const data = JSON.parse(text)
              setError(data.message || 'Failed to archive event')
            } catch (parseError) {
              setError(`Failed to archive event (${res.status}): Invalid response from server`)
            }
          } else {
            setError(`Failed to archive event (${res.status}): Empty response from server`)
          }
        } else {
          setError(`Failed to archive event (${res.status}): Server returned an error`)
        }
      }
    } catch (e) {
      setError('Failed to archive event: ' + e.message)
    }
  }

  const handleRestoreClick = async (eventId, eventTitle) => {
    const result = await Swal.fire({
      icon: 'question',
      title: 'Restore Event',
      text: `Are you sure you want to restore "${eventTitle || 'this event'}"?`,
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, restore it'
    });
    if (!result.isConfirmed) {
      return;
    }
    try {
      setError(null)
      const res = await fetch(`/api/president/calendar/events/${eventId}/restore?userId=${user._id}`, { method: 'PUT' })
      logApiResponse(res);
      if (res.ok) {
        fetchEvents()
        fetchArchivedEvents()
      } else {
        // Handle error response - safely parse JSON
        const contentType = res.headers.get('content-type')
        const isJson = contentType && contentType.includes('application/json')

        if (isJson) {
          const text = await res.text()
          if (text.trim()) {
            try {
              const data = JSON.parse(text)
              setError(data.message || 'Failed to restore event')
            } catch (parseError) {
              setError(`Failed to restore event (${res.status}): Invalid response from server`)
            }
          } else {
            setError(`Failed to restore event (${res.status}): Empty response from server`)
          }
        } else {
          setError(`Failed to restore event (${res.status}): Server returned an error`)
        }
      }
    } catch (e) {
      setError('Failed to restore event: ' + e.message)
    }
  }

  const handleDeleteClick = async (eventId, eventTitle) => {
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Permanently Delete Event',
      text: `Are you sure you want to permanently delete "${eventTitle || 'this event'}"? This action cannot be undone.`,
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it'
    });
    if (!result.isConfirmed) {
      return;
    }
    try {
      setError(null)
      const res = await fetch(`/api/president/calendar/events/${eventId}?userId=${user._id}`, { method: 'DELETE' })
      logApiResponse(res);
      if (res.ok) {
        fetchArchivedEvents()
      } else {
        // Handle error response - safely parse JSON
        const contentType = res.headers.get('content-type')
        const isJson = contentType && contentType.includes('application/json')

        if (isJson) {
          const text = await res.text()
          if (text.trim()) {
            try {
              const data = JSON.parse(text)
              setError(data.message || 'Failed to delete event')
            } catch (parseError) {
              setError(`Failed to delete event (${res.status}): Invalid response from server`)
            }
          } else {
            setError(`Failed to delete event (${res.status}): Empty response from server`)
          }
        } else {
          setError(`Failed to delete event (${res.status}): Server returned an error`)
        }
      }
    } catch (e) {
      setError('Failed to delete event: ' + e.message)
    }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className='bg-white min-h-screen flex flex-col lg:flex-row'>
      {/* Mobile Header */}
      <div className='lg:hidden bg-blue-950 text-white p-4 flex justify-between items-center'>
        <div className='flex items-center space-x-2'>
          <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-12 h-auto' />
          <span className='text-sm font-bold'>BUKSU SSC</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className='text-white p-2 hover:bg-blue-900 rounded'
          aria-label="Toggle menu"
        >
          <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            {sidebarOpen ? (
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
            ) : (
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 6h16M4 12h16M4 18h16' />
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar Panel */}
      <aside className={`bg-blue-950 text-white w-64 min-h-screen p-4 fixed lg:static inset-y-0 left-0 z-40 transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className='mb-8'>
          <div className='flex items-center justify-center space-x-4 mb-4'>
            <Link to="/" className='flex items-center space-x-4' onClick={() => setSidebarOpen(false)}>
              <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-16 sm:w-20 h-auto' />
              <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='w-16 sm:w-20 h-auto hidden sm:block' />
            </Link>
          </div>
          <div className='text-center'>
            <span className='text-xs sm:text-sm font-bold leading-none'>BUKIDNON STATE UNIVERSITY</span>
            <br />
            <span className='text-xs font-semibold leading-none'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <ul className='space-y-4'>
          <li><Link to="/president-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Handbook</Link></li>
          <li><Link to="/president-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Memorandum</Link></li>
          <li><Link to="/president-policy" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Policy</Link></li>
          <li><Link to="/president-calendar" className="block py-2 px-4 bg-blue-800 rounded transition" onClick={() => setSidebarOpen(false)}>Calendar</Link></li>
          <li><Link to="/president-notifications" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Notifications</Link></li>
          <li><Link to="/president-activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition" onClick={() => setSidebarOpen(false)}>Activity Logs</Link></li>
          <li><button onClick={() => { handleLogout(); setSidebarOpen(false); }} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className='fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className='flex-1 p-4 sm:p-6 md:p-8'>
        <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6'>
          <h1 className='text-xl sm:text-2xl font-bold text-blue-950'>Manage Calendar</h1>
          <button 
            onClick={() => { setLoading(true); fetchEvents(); }} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded transition flex items-center space-x-2 min-h-[44px]"
            title="Refresh page data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className='hidden sm:inline'>Refresh</span>
          </button>
        </div>

        <div className='mb-4 sm:mb-6 flex flex-wrap gap-2'>
          <button onClick={connectGoogle} className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 min-h-[44px]'>
            Connect Google Calendar
          </button>
          <button onClick={() => { fetchEvents(); fetchArchivedEvents(); }} className='bg-gray-200 text-blue-950 px-4 py-2 rounded hover:bg-gray-300 min-h-[44px]'>
            Refresh Events
          </button>
        </div>

        <form onSubmit={createEvent} className='mb-6 sm:mb-8 grid grid-cols-1 gap-4 max-w-xl'>
          <input className='border p-2 rounded text-black min-h-[44px]' placeholder='Title' value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} required />
          <input className='border p-2 rounded text-black min-h-[44px]' placeholder='Location' value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
          <textarea className='border p-2 rounded text-black' placeholder='Description' value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div>
            <label className='text-sm text-gray-600 block mb-1'>Start Date & Time</label>
            <DatePicker
              selected={startDate}
              onChange={(date) => {
                setStartDate(date)
                setForm({ ...form, startISO: date ? toLocalISOString(date) : '' })
              }}
              showTimeSelect
              timeFormat="h:mm aa"
              timeIntervals={15}
              dateFormat="MMMM d, yyyy h:mm aa"
              className='border p-2 rounded text-black w-full'
              placeholderText="Select start date and time"
              required
            />
          </div>
          <div>
            <label className='text-sm text-gray-600 block mb-1'>End Date & Time</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => {
                setEndDate(date)
                setForm({ ...form, endISO: date ? toLocalISOString(date) : '' })
              }}
              showTimeSelect
              timeFormat="h:mm aa"
              timeIntervals={5}
              dateFormat="MMMM d, yyyy h:mm aa"
              className='border p-2 rounded text-black w-full'
              placeholderText="Select end date and time"
              minDate={startDate}
              required
            />
          </div>
          <button type='submit' className='bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 min-h-[44px]'>Create Event</button>
        </form>

        {error && (
          <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded'>
            {error}
            <button onClick={() => setError(null)} className='ml-2 text-red-700 hover:text-red-900 font-bold min-h-[44px] min-w-[44px]'>×</button>
          </div>
        )}

        <div className='border rounded mb-6 sm:mb-8'>
          <div className='p-3 sm:p-4 border-b font-semibold text-black text-sm sm:text-base'>Upcoming Events {loading && '(loading...)'}</div>
          <ul>
            {events.map(ev => (
              <li key={ev.id} className='p-3 sm:p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between text-black gap-2'>
                <div className='flex-1 min-w-0'>
                  <div className='font-medium break-words'>{ev.summary || '(No title)'}</div>
                  <div className='text-sm text-gray-600 break-words'>
                    {ev.start?.dateTime ? formatEventDateTime(ev.start.dateTime) : ev.start?.date || ''}
                    {ev.start?.dateTime && ev.end?.dateTime && ' — '}
                    {ev.end?.dateTime ? formatEventDateTime(ev.end.dateTime) : ev.end?.date || ''}
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => handleArchiveClick(ev.id, ev.summary)}
                    className='px-3 py-1.5 rounded bg-orange-600 text-white hover:bg-orange-700 min-h-[44px] whitespace-nowrap'
                  >
                    Archive
                  </button>
                </div>
              </li>
            ))}
            {events.length === 0 && (
              <li className='p-4 text-gray-500'>No upcoming events or calendar not connected.</li>
            )}
          </ul>
        </div>

        <div className='border rounded'>
          <div className='p-3 sm:p-4 border-b font-semibold text-black text-sm sm:text-base'>Archived Events</div>
          <ul>
            {archivedEvents.map(ev => (
              <li key={ev._id} className='p-3 sm:p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between text-black gap-2'>
                <div className='flex-1 min-w-0'>
                  <div className='font-medium break-words'>{ev.summary || '(No title)'}</div>
                  <div className='text-sm text-gray-600 break-words'>
                    {ev.start ? formatEventDateTime(ev.start) : ''}
                    {ev.start && ev.end && ' — '}
                    {ev.end ? formatEventDateTime(ev.end) : ''}
                  </div>
                  <div className='text-xs text-gray-500'>
                    Archived on {ev.archivedAt ? formatEventDateTime(ev.archivedAt) : 'Unknown'}
                  </div>
                </div>
                <div className='flex space-x-2'>
                  <button
                    onClick={() => handleRestoreClick(ev.googleEventId, ev.summary)}
                    className='px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 min-h-[44px] whitespace-nowrap'
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handleDeleteClick(ev.googleEventId, ev.summary)}
                    className='px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 min-h-[44px] whitespace-nowrap'
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {archivedEvents.length === 0 && (
              <li className='p-4 text-gray-500'>No archived events.</li>
            )}
          </ul>
        </div>
      </main>
    </div>
  )
}

export default PresidentCalendar


