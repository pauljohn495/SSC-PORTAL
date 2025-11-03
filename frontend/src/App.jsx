import { useState } from 'react'
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

function App() {
  return (
    <AuthProvider>
      <Router>
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
