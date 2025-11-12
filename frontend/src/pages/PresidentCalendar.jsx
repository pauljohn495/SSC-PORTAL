import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { logApiResponse } from '../utils/fetchWithLogging'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

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
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ summary: '', description: '', startISO: '', endISO: '', location: '' })
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!user || user.role !== 'president') {
      navigate('/')
      return
    }
    fetchEvents()
  }, [user])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/president/calendar/events?userId=${user._id}`)
      logApiResponse(res);
      if (res.status === 409) return // not connected yet
      const data = await res.json()
      setEvents(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
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

  const handleDeleteClick = async (eventId, eventTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${eventTitle || 'this event'}"? This action cannot be undone.`)) {
      return
    }
    try {
      setError(null)
      const res = await fetch(`/api/president/calendar/events/${eventId}?userId=${user._id}`, { method: 'DELETE' })
      logApiResponse(res);
      if (res.ok) {
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
    <div className='bg-white min-h-screen flex'>
      <aside className='bg-blue-950 text-white w-64 min-h-screen p-4'>
        <div className='mb-8'>
          <div className='flex items-center justify-center space-x-4 mb-4'>
            <Link to="/" className='flex items-center space-x-4'>
              <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-20 h-auto' />
              <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='w-20 h-auto' />
            </Link>
          </div>
          <div className='text-center'>
            <span className='text-sm font-bold leading-none'>BUKIDNON STATE UNIVERSITY</span>
            <br />
            <span className='text-xs font-semibold leading-none'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <ul className='space-y-4'>
          <li><Link to="/president-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/president-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/president-calendar" className="block py-2 px-4 bg-blue-800 rounded transition">Calendar</Link></li>
          <li><Link to="/president-notifications" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Notifications</Link></li>
          <li><Link to="/president-activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      <main className='flex-1 p-8'>
        <div className='flex justify-between items-center mb-6'>
          <h1 className='text-2xl font-bold text-blue-950'>Manage Calendar</h1>
          <button 
            onClick={() => { setLoading(true); fetchEvents(); }} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition flex items-center space-x-2"
            title="Refresh page data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>

        <div className='mb-6'>
          <button onClick={connectGoogle} className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700'>
            Connect Google Calendar
          </button>
          <button onClick={fetchEvents} className='ml-2 bg-gray-200 text-blue-950 px-4 py-2 rounded hover:bg-gray-300'>
            Refresh Events
          </button>
        </div>

        <form onSubmit={createEvent} className='mb-8 grid grid-cols-1 gap-4 max-w-xl'>
          <input className='border p-2 rounded text-black' placeholder='Title' value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} required />
          <input className='border p-2 rounded text-black' placeholder='Location' value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
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
          <button type='submit' className='bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700'>Create Event</button>
        </form>

        {error && (
          <div className='mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded'>
            {error}
            <button onClick={() => setError(null)} className='ml-2 text-red-700 hover:text-red-900 font-bold'>×</button>
          </div>
        )}

        <div className='border rounded'>
          <div className='p-4 border-b font-semibold text-black'>Upcoming Events {loading && '(loading...)'}</div>
          <ul>
            {events.map(ev => (
              <li key={ev.id} className='p-4 border-b flex items-center justify-between text-black'>
                <div className='flex-1'>
                  <div className='font-medium'>{ev.summary || '(No title)'}</div>
                  <div className='text-sm text-gray-600'>
                    {ev.start?.dateTime ? formatEventDateTime(ev.start.dateTime) : ev.start?.date || ''} 
                    {ev.start?.dateTime && ev.end?.dateTime && ' — '}
                    {ev.end?.dateTime ? formatEventDateTime(ev.end.dateTime) : ev.end?.date || ''}
                  </div>
                </div>
                <div>
                  <button
                    onClick={() => handleDeleteClick(ev.id, ev.summary)}
                    className='px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700'
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {events.length === 0 && (
              <li className='p-4 text-gray-500'>No upcoming events or calendar not connected.</li>
            )}
          </ul>
        </div>
      </main>
    </div>
  )
}

export default PresidentCalendar


