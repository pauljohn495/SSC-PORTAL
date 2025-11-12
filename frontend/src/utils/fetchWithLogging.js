// Utility function to wrap fetch and log API responses from X-API-Log header
export const fetchWithLogging = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    
    // Check for API log header and log to browser console
    const apiLogHeader = response.headers.get('X-API-Log');
    if (apiLogHeader) {
      try {
        const logData = JSON.parse(apiLogHeader);
        console.log(JSON.stringify(logData));
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

// Helper function to log API response header from any fetch response
export const logApiResponse = (response) => {
  const apiLogHeader = response.headers.get('X-API-Log');
  if (apiLogHeader) {
    try {
      const logData = JSON.parse(apiLogHeader);
      console.log('[API Log]', JSON.stringify(logData, null, 2));
    } catch (e) {
      // Ignore parsing errors
    }
  }
};

