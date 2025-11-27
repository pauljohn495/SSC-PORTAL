import { useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Home from './pages/Home'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import SetupAccount from './pages/SetupAccount'
import Memorandum from './pages/Memorandum'
import StudentHandbook from './pages/StudentHandbook'
import Policy from './pages/Policy'
import AdminDashboard from './pages/AdminDashboard'
import AdminHandbook from './pages/AdminHandbook'
import AdminMemorandum from './pages/AdminMemorandum'
import AddPresident from './pages/AddPresident'
import AddAdmin from './pages/AddAdmin'
import ManageUsers from './pages/ManageUsers'
import ActivityLogs from './pages/ActivityLogs'
import Archived from './pages/Archived'
import PresidentDashboard from './pages/PresidentDashboard'
import PresidentMemorandum from './pages/PresidentMemorandum'
import PresidentHandbook from './pages/PresidentHandbook'
import PresidentNotifications from './pages/PresidentNotifications'
import PresidentActivityLogs from './pages/PresidentActivityLogs'
import PresidentPolicy from './pages/PresidentPolicy'
import BuksuCalendar from './pages/BuksuCalendar'
import PresidentCalendar from './pages/PresidentCalendar'
import Search from './pages/Search'
import AdminPolicy from './pages/AdminPolicy'
import AdminBackup from './pages/AdminBackup'
import { subscribeOnMessage } from './firebase'
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { onEvent } from './realtime/socket'

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
    // Socket.IO events -> show toast
    const off1 = onEvent('notification:published', (n) => {
      const msg = n?.message || n?.title || 'New notification'
      toast.info(msg, { position: 'bottom-right', autoClose: 5000 })
    })
    const off2 = onEvent('handbook:approved', (h) => {
      toast.info(`Handbook page ${h?.pageNumber} approved`, { position: 'bottom-right', autoClose: 5000 })
    })
    const off3 = onEvent('memorandum:approved', (m) => {
      toast.info(`Memorandum approved: ${m?.title || ''}`, { position: 'bottom-right', autoClose: 5000 })
    })
    return () => {
      try { unsubscribe() } catch {}
      if (navigator?.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', onSwMessage)
      }
      off1 && off1(); off2 && off2(); off3 && off3();
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
          <Route path="/setup-account" element={<SetupAccount />} />
          <Route path="/memorandum" element={<Memorandum />} />
          <Route path="/student-handbook" element={<StudentHandbook />} />
          <Route path="/policy" element={<Policy />} />
          <Route path="/admin-dashboard" element={<AdminDashboard />} />
          <Route path="/admin-handbook" element={<AdminHandbook />} />
          <Route path="/admin-policy" element={<AdminPolicy />} />
          <Route path="/admin-memorandum" element={<AdminMemorandum />} />
          <Route path="/admin-backup" element={<AdminBackup />} />
          <Route path="/manage-users" element={<ManageUsers />} />
          <Route path="/activity-logs" element={<ActivityLogs />} />
          <Route path="/archived" element={<Archived />} />
          <Route path="/president-dashboard" element={<PresidentDashboard />} />
          <Route path="/president-memorandum" element={<PresidentMemorandum />} />
          <Route path="/president-handbook" element={<PresidentHandbook />} />
          <Route path="/president-policy" element={<PresidentPolicy />} />
          <Route path="/president-notifications" element={<PresidentNotifications />} />
          <Route path="/president-activity-logs" element={<PresidentActivityLogs />} />
          <Route path="/buksu-calendar" element={<BuksuCalendar />} />
          <Route path="/president-calendar" element={<PresidentCalendar />} />
          <Route path="/search" element={<Search />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
