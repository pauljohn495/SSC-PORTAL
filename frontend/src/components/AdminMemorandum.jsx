import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const AdminMemorandum = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);

  if (!user || user.role !== 'admin') {
    return <div>Access Denied</div>;
  }

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    try {
      const response = await fetch('http://localhost:5001/api/admin/memorandums');
      const data = await response.json();
      setDrafts(data);
    } catch (error) {
      console.error('Error fetching memorandum drafts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const response = await fetch(`http://localhost:5001/api/admin/memorandums/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });
      if (response.ok) {
        fetchDrafts(); // Refresh list
      }
    } catch (error) {
      console.error('Error approving memorandum:', error);
    }
  };

  const handleReject = async (id) => {
    try {
      const response = await fetch(`http://localhost:5001/api/admin/memorandums/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected' })
      });
      if (response.ok) {
        fetchDrafts(); // Refresh list
      }
    } catch (error) {
      console.error('Error rejecting memorandum:', error);
    }
  };

  const handleViewPDF = (fileUrl) => {
    window.open(fileUrl, '_blank');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className='bg-white min-h-screen flex'>
      {/* Sidebar Panel */}
      <aside className='bg-blue-950 text-white w-64 min-h-screen p-4'>
        <div className='mb-8'>
          <div className='flex items-center justify-center space-x-4 mb-4'>
            <img src="/src/assets/buksu-white.png" alt="BUKSU White Logo" className='w-20 h-auto' />
            <img src="/src/assets/ssc-logo.png" alt="SSC Logo" className='w-20 h-auto' />
          </div>
          <div className='text-center'>
            <span className='text-sm font-bold leading-none'>BUKIDNON STATE UNIVERSITY</span>
            <br />
            <span className='text-xs font-semibold leading-none'>SUPREME STUDENT COUNCIL</span>
          </div>
        </div>
        <ul className='space-y-4'>
          <li><Link to="/admin-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 bg-blue-800 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className='text-3xl font-bold mb-8 text-blue-950'>Memorandum Drafts</h1>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className='space-y-4'>
              {drafts.length > 0 ? (
                drafts.map((draft) => (
                  <div key={draft._id} className='bg-white p-6 rounded-lg shadow-md flex justify-between items-center'>
                    <div className='flex-1'>
                      <h2 className='text-xl font-semibold text-gray-800 mb-2'>{draft.title}</h2>
                      <p className='text-sm text-gray-600 mb-2'>Year: {draft.year}</p>
                      <p className='text-sm text-gray-600 mb-2'>Status: <span className={`font-semibold ${draft.status === 'approved' ? 'text-green-600' : draft.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'}`}>{draft.status}</span></p>
                      <p className='text-sm text-gray-600'>Created by: {draft.createdBy?.name} ({draft.createdBy?.email})</p>
                    </div>
                    <div className='flex flex-col space-y-2'>
                      <button
                        onClick={() => handleViewPDF(draft.fileUrl)}
                        className='bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors'
                      >
                        View PDF
                      </button>
                      {draft.status === 'draft' && (
                        <>
                          <button
                            onClick={() => handleApprove(draft._id)}
                            className='bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors'
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(draft._id)}
                            className='bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors'
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className='text-center text-gray-500'>No memorandum drafts available.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminMemorandum;
