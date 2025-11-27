import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Swal from 'sweetalert2';

const AdminHandbook = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [sectionDrafts, setSectionDrafts] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [sectionActionId, setSectionActionId] = useState(null);

  const isAuthorized = !!user && user.role === 'admin';

  useEffect(() => {
    if (isAuthorized) {
      fetchSectionDrafts();
    }
  }, [isAuthorized]);

  const fetchSectionDrafts = async () => {
    try {
      setSectionsLoading(true);
      const response = await fetch('http://localhost:5001/api/admin/handbook-sections');
      const apiLogHeader = response.headers.get('X-API-Log');
      if (apiLogHeader) {
        try {
          const logData = JSON.parse(apiLogHeader);
          console.log('[API Log]', JSON.stringify(logData, null, 2));
        } catch (e) {}
      }
      const data = await response.json();
      setSectionDrafts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching handbook sections:', error);
    } finally {
      setSectionsLoading(false);
    }
  };

  const updateSectionStatus = async (sectionId, status) => {
    if (!user?._id) return;
    try {
      setSectionActionId(sectionId);
      const response = await fetch(`http://localhost:5001/api/admin/handbook-sections/${sectionId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminId: user._id })
      });
      const apiLogHeader = response.headers.get('X-API-Log');
      if (apiLogHeader) {
        try {
          const logData = JSON.parse(apiLogHeader);
          console.log('[API Log]', JSON.stringify(logData, null, 2));
        } catch (e) {}
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update section status');
      }
      fetchSectionDrafts();
    } catch (error) {
      console.error('Error updating section status:', error);
    } finally {
      setSectionActionId(null);
    }
  };

  const handleArchiveSection = async (section) => {
    if (!user?._id) return;
    const result = await Swal.fire({
      icon: 'warning',
      title: 'Archive Section',
      text: `Are you sure you want to archive "${section.title}"?`,
      showCancelButton: true,
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, archive it'
    });
    if (!result.isConfirmed) return;

    try {
      setSectionActionId(section._id);
      const response = await fetch(`http://localhost:5001/api/admin/handbook-sections/${section._id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user._id })
      });
      const apiLogHeader = response.headers.get('X-API-Log');
      if (apiLogHeader) {
        try {
          const logData = JSON.parse(apiLogHeader);
          console.log('[API Log]', JSON.stringify(logData, null, 2));
        } catch (e) {}
      }
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to archive section');
      }
      Swal.fire({
        icon: 'success',
        title: 'Archived',
        text: 'Section has been archived.',
        timer: 1500,
        showConfirmButton: false
      });
      fetchSectionDrafts();
    } catch (error) {
      console.error('Error archiving section:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'Failed to archive section'
      });
    } finally {
      setSectionActionId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getSectionBadgeClass = (status) => {
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const getSectionBadgeText = (status) => {
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    return 'Pending';
  };

  return (
    <div className='bg-white min-h-screen flex'>
      {/* Sidebar Panel */}
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
          <li><Link to="/admin-handbook" className="block py-2 px-4 bg-blue-800 rounded transition">Handbook</Link></li>
          <li><Link to="/admin-policy" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Policy</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><Link to="/archived" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Archived</Link></li>
          <li><Link to="/admin-backup" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Backup</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto">
          {!isAuthorized ? (
            <div>Access Denied</div>
          ) : (
            <h1 className='text-3xl font-bold mb-8 text-blue-950'>Handbook Sections</h1>
          )}

          {isAuthorized && (
            <div className='bg-white rounded-lg shadow-md mt-8'>
              <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
                <div>
                  <h2 className='text-xl font-bold text-blue-950'>Handbook Sections</h2>
                  <p className='text-sm text-gray-500'>Review and approve section uploads from the president.</p>
                </div>
                <button
                  onClick={fetchSectionDrafts}
                  className='flex items-center gap-2 px-4 py-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors'
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
              {sectionsLoading ? (
                <div className='text-center py-12 text-gray-500'>Loading sections...</div>
              ) : sectionDrafts.length === 0 ? (
                <div className='text-center py-12 text-gray-500'>No section submissions yet.</div>
              ) : (
                <div>
                  {sectionDrafts.map((section, index) => (
                    <div
                      key={section._id}
                      className={`flex flex-col lg:flex-row lg:items-center border-b border-gray-200 px-6 py-4 gap-4 ${
                        index === sectionDrafts.length - 1 ? 'border-b-0 rounded-b-lg' : ''
                      }`}
                    >
                      <div className='flex-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <p className='text-gray-800 font-semibold'>{section.title}</p>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getSectionBadgeClass(section.status)}`}>
                            {getSectionBadgeText(section.status)}
                          </span>
                        </div>
                        {section.description && (
                          <p className='text-sm text-gray-600 mt-1'>{section.description}</p>
                        )}
                        <p className='text-xs text-gray-400 mt-1'>
                          Uploaded by {section.createdBy?.name || 'Unknown'} • {new Date(section.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className='flex items-center gap-2'>
                        {section.status !== 'approved' && (
                          <button
                            onClick={() => updateSectionStatus(section._id, 'approved')}
                            disabled={sectionActionId === section._id}
                            className='px-4 py-2 text-sm font-semibold text-green-600 hover:text-green-800 transition disabled:opacity-50 disabled:cursor-not-allowed'
                          >
                            {sectionActionId === section._id ? 'Processing...' : 'Approve'}
                          </button>
                        )}
                        {section.status === 'approved' && (
                          <button
                            onClick={() => updateSectionStatus(section._id, 'rejected')}
                            disabled={sectionActionId === section._id}
                            className='px-4 py-2 text-sm font-semibold text-yellow-600 hover:text-yellow-800 transition disabled:opacity-50 disabled:cursor-not-allowed'
                          >
                            {sectionActionId === section._id ? 'Processing...' : 'Reject'}
                          </button>
                        )}
                        <button
                          onClick={() => handleArchiveSection(section)}
                          disabled={sectionActionId === section._id}
                          className='px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                          {sectionActionId === section._id ? 'Archiving...' : 'Archive'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminHandbook;
