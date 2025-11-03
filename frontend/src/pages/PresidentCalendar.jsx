import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const PresidentCalendar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ summary: '', description: '', startISO: '', endISO: '', location: '' })

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
    const { url } = await res.json()
    window.open(url, '_blank', 'width=500,height=700')
  }

  const createEvent = async (e) => {
    e.preventDefault()
    const body = { ...form, userId: user._id }
    const res = await fetch('/api/president/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (res.ok) {
      setForm({ summary: '', description: '', startISO: '', endISO: '', location: '' })
      fetchEvents()
    }
  }

  const updateEvent = async (eventId, updates) => {
    const res = await fetch(`/api/president/calendar/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, userId: user._id })
    })
    if (res.ok) fetchEvents()
  }

  const deleteEvent = async (eventId) => {
    const res = await fetch(`/api/president/calendar/events/${eventId}?userId=${user._id}`, { method: 'DELETE' })
    if (res.ok) fetchEvents()
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
        <h1 className='text-2xl font-bold text-blue-950 mb-6'>Manage Calendar</h1>

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
          <label className='text-sm text-gray-600'>Start</label>
          <input type='datetime-local' className='border p-2 rounded text-black' value={form.startISO} onChange={e => setForm({ ...form, startISO: e.target.value ? new Date(e.target.value).toISOString() : '' })} required />
          <label className='text-sm text-gray-600'>End</label>
          <input type='datetime-local' className='border p-2 rounded text-black' value={form.endISO} onChange={e => setForm({ ...form, endISO: e.target.value ? new Date(e.target.value).toISOString() : '' })} required />
          <button type='submit' className='bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700'>Create Event</button>
        </form>

        <div className='border rounded'>
          <div className='p-4 border-b font-semibold text-black'>Upcoming Events {loading && '(loading...)'}</div>
          <ul>
            {events.map(ev => (
              <li key={ev.id} className='p-4 border-b flex items-center justify-between text-black'>
                <div>
                  <div className='font-medium'>{ev.summary || '(No title)'}</div>
                  <div className='text-sm text-gray-600'>
                    {ev.start?.dateTime || ev.start?.date} — {ev.end?.dateTime || ev.end?.date}
                  </div>
                </div>
                <div className='space-x-2'>
                  <button onClick={() => updateEvent(ev.id, { summary: prompt('New title', ev.summary) || ev.summary })} className='px-3 py-1 rounded bg-yellow-500 text-white hover:bg-yellow-600'>Rename</button>
                  <button onClick={() => deleteEvent(ev.id)} className='px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700'>Delete</button>
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


