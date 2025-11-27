import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/api';

const AdminBackup = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [lastGeneratedAt, setLastGeneratedAt] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState(null);
  const fileInputRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const triggerBackup = async () => {
    setMessage('');
    setMessageType('');
    setDownloading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/admin/backups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user?._id })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate backup.';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match?.[1] || `ipt-collab-backup-${new Date().toISOString()}.zip`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage('Backup generated successfully. Store it in a safe location.');
      setMessageType('success');
      setLastGeneratedAt(new Date().toLocaleString());
    } catch (error) {
      console.error('Backup error:', error);
      setMessage(error.message || 'Failed to generate backup.');
      setMessageType('error');
    } finally {
      setDownloading(false);
    }
  };

  const handleImportClick = () => {
    if (importing) return;
    fileInputRef.current?.click();
  };

  const handleImportChange = async (event) => {
    const backupFile = event.target.files?.[0];
    if (!backupFile) return;

    setMessage('');
    setMessageType('');
    setImportSummary(null);
    setImporting(true);

    const formData = new FormData();
    formData.append('backup', backupFile);
    if (user?._id) {
      formData.append('adminId', user._id);
    }

    try {
      const response = await fetch(`${API_BASE_URL}/admin/backups/import`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to import backup.');
      }

      setMessage(data.message || 'Backup imported successfully.');
      setMessageType('success');
      setImportSummary(data.summary || null);
    } catch (error) {
      console.error('Import error:', error);
      setMessage(error.message || 'Failed to import backup.');
      setMessageType('error');
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

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
          <li><Link to="/admin-handbook" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Handbook</Link></li>
          <li><Link to="/admin-policy" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Policy</Link></li>
          <li><Link to="/admin-memorandum" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Memorandum</Link></li>
          <li><Link to="/manage-users" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Manage User</Link></li>
          <li><Link to="/activity-logs" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Activity Logs</Link></li>
          <li><Link to="/archived" className="block py-2 px-4 hover:bg-blue-900 rounded transition">Archived</Link></li>
          <li><Link to="/admin-backup" className="block py-2 px-4 bg-blue-800 rounded transition">Backup</Link></li>
          <li><button onClick={handleLogout} className="block py-2 px-4 hover:bg-blue-900 rounded transition text-left w-full">Logout</button></li>
        </ul>
      </aside>

      <main className="flex-1 bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className='text-3xl font-bold text-blue-950'>Create Backup</h1>
          </div>

          {message && (
            <div
              className={`px-4 py-3 rounded-lg text-sm ${
                messageType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message}
            </div>
          )}

          <div className='bg-white rounded-lg shadow-md border border-gray-200 p-6 space-y-4'>
            <div className='flex flex-col gap-2'>
              <p className='text-lg font-semibold text-blue-950'>Generate Backup</p>
              {lastGeneratedAt && (
                <p className='text-xs text-gray-500'>Last generated: {lastGeneratedAt}</p>
              )}
            </div>
            <button
              type='button'
              onClick={triggerBackup}
              disabled={downloading}
              className='inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-blue-300 disabled:cursor-not-allowed'
            >
              {downloading ? 'Preparing backup...' : 'Download backup zip'}
            </button>
            <p className='text-black text-sm font-bold'>
                Click to Generate a backup
              </p>
          </div>

          <div className='bg-white rounded-lg shadow-md border border-gray-200 p-6 space-y-4'>
            <div className='flex flex-col gap-2'>
              <p className='text-lg font-semibold text-blue-950'>Import Backup</p>
            </div>
            <input
              type='file'
              accept='.zip'
              ref={fileInputRef}
              onChange={handleImportChange}
              className='hidden'
            />
            <button
              type='button'
              onClick={handleImportClick}
              disabled={importing}
              className='inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-green-300 disabled:cursor-not-allowed'
            >
              {importing ? 'Importing backup...' : 'Import backup zip'}
            </button>
            <p className='text-black text-sm font-bold'>
                Click to Import a backup
              </p>
            {importSummary && (
              <div className='bg-gray-50 border border-gray-200 rounded-lg p-4'>
                <p className='text-sm font-semibold text-gray-700 mb-2'>Collections imported</p>
                <ul className='space-y-1 text-sm text-gray-600'>
                  {Object.entries(importSummary).map(([key, detail]) => (
                    <li key={key} className='flex justify-between'>
                      <span className='capitalize'>{key}</span>
                      <span>{detail?.inserted ?? 0} docs{detail?.status === 'missing_from_backup' ? ' (missing)' : ''}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminBackup;

