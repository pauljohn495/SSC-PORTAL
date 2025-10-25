import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Home from './components/Home'
import Login from './components/Login'
import ResetPassword from './components/ResetPassword'
import Memorandum from './components/Memorandum'
import StudentHandbook from './components/StudentHandbook'
import AdminDashboard from './components/AdminDashboard'
import AdminHandbook from './components/AdminHandbook'
import AdminMemorandum from './components/AdminMemorandum'
import AddPresident from './components/AddPresident'
import AddAdmin from './components/AddAdmin'
import ManageUsers from './components/ManageUsers'

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
          <Route path="/admin-dashboard" element={<AdminHandbook />} />
          <Route path="/admin-handbook" element={<AdminHandbook />} />
          <Route path="/admin-memorandum" element={<AdminMemorandum />} />

          <Route path="/manage-users" element={<ManageUsers />} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
