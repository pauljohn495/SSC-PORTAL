import React, { useState } from 'react';

function PresidentUpload() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleChange = e => {
    setFile(e.target.files[0]);
    setStatus('');
  };

  const handleUpload = async e => {
    e.preventDefault();
    if (!file) {
      setStatus('Please select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      const response = await fetch('/api/president/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (response.ok) {
        setStatus('Upload successful!');
        setFile(null);
      } else {
        setStatus(result.error || 'Upload failed.');
      }
    } catch (error) {
      setStatus('Error uploading file.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleUpload} style={{ marginTop: '24px', border: '1px solid #ccc', padding: '16px' }}>
      <label>
        <strong>Select file:</strong>
        <input type="file" onChange={handleChange} />
      </label>
      <button type="submit" disabled={isUploading} style={{ marginLeft: '12px' }}>
        {isUploading ? 'Uploading...' : 'Upload'}
      </button>
      <div style={{ marginTop: '12px', color: status === 'Upload successful!' ? 'green' : 'red' }}>{status}</div>
    </form>
  );
}

export default PresidentUpload;