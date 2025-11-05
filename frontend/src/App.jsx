import { useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Memorandum from './pages/Memorandum'
import StudentHandbook from './pages/StudentHandbook'
import AdminDashboard from './pages/AdminDashboard'
import AdminHandbook from './pages/AdminHandbook'
import AdminMemorandum from './pages/AdminMemorandum'
import AddPresident from './pages/AddPresident'
import AddAdmin from './pages/AddAdmin'
import ManageUsers from './pages/ManageUsers'
import ActivityLogs from './pages/ActivityLogs'
import PresidentDashboard from './pages/PresidentDashboard'
import PresidentMemorandum from './pages/PresidentMemorandum'
import PresidentHandbook from './pages/PresidentHandbook'
import PresidentNotifications from './pages/PresidentNotifications'
import PresidentActivityLogs from './pages/PresidentActivityLogs'
import BuksuCalendar from './pages/BuksuCalendar'
import PresidentCalendar from './pages/PresidentCalendar'
import { subscribeOnMessage } from './firebase'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

function App() {

  useEffect(() => {
    let unsubscribe = () => {}
    (async () => {
      unsubscribe = await subscribeOnMessage((payload) => {
        const n = payload?.notification || {}
        const d = payload?.data || {}
        const title = n.title || d.title || 'Notification'
        const body = n.body || d.body || ''
        toast.info(body || title, { position: 'bottom-right', autoClose: 5000, hideProgressBar: false, closeOnClick: true })
      })
    })()
    // Also listen for messages forwarded by the service worker (background cases)
    const onSwMessage = (event) => {
      if (event?.data?.type === 'fcm-bg') {
        const payload = event.data.payload || {}
        const n = payload?.notification || {}
        const d = payload?.data || {}
        const title = n.title || d.title || 'Notification'
        const body = n.body || d.body || ''
        toast.info(body || title, { position: 'bottom-right', autoClose: 5000, hideProgressBar: false, closeOnClick: true })
      }
    }
    if (navigator?.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', onSwMessage)
    }
    return () => {
      try { unsubscribe() } catch {}
      if (navigator?.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage)
      }
    }
  }, [])

  return (
    <AuthProvider>
      <Router>
        <ToastContainer />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/memorandum" element={<Memorandum />} />
          <Route path="/student-handbook" element={<StudentHandbook />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/admin-handbook" element={<AdminHandbook />} />
          <Route path="/admin-memorandum" element={<AdminMemorandum />} />
          <Route path="/manage-users" element={<ManageUsers />} />
          <Route path="/activity-logs" element={<ActivityLogs />} />
          <Route path="/president-dashboard" element={<PresidentDashboard />} />
          <Route path="/president-memorandum" element={<PresidentMemorandum />} />
          <Route path="/president-handbook" element={<PresidentHandbook />} />
          <Route path="/president-notifications" element={<PresidentNotifications />} />
          <Route path="/president-activity-logs" element={<PresidentActivityLogs />} />
          <Route path="/buksu-calendar" element={<BuksuCalendar />} />
          <Route path="/president-calendar" element={<PresidentCalendar />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
