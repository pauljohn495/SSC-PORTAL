// Utility function to wrap fetch and log API responses from X-API-Log header
let globalLoggerInstalled = false;
let originalFetch = null;

export const fetchWithLogging = async (url, options = {}) => {
  const response = await (originalFetch ? originalFetch(url, options) : fetch(url, options));
  logApiResponse(response);
  return response;
};

// Helper function to log API response header from any fetch response
export const logApiResponse = (response) => {
  const apiLogHeader = response.headers.get('X-API-Log');
  if (apiLogHeader) {
    try {
      const logData = JSON.parse(apiLogHeader);
      
      // Skip logging for president handbook endpoints
      if (logData.endpoint && (
        logData.endpoint.includes('/president/handbook') || 
        logData.endpoint.includes('/president/handbook-sections') ||
        logData.endpoint.includes('/admin/handbook')
      )) {
        return;
      }
      
      console.log('[API Log]', JSON.stringify(logData, null, 2));
    } catch (e) {
      // Ignore parsing errors
    }
  }
};

export const installGlobalApiLogger = () => {
  if (globalLoggerInstalled || typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return;
  }

  originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    
    // Skip logging for president handbook related endpoints
    const url = args[0];
    if (typeof url === 'string' && (
      url.includes('/president/handbook') ||
      url.includes('/president/handbook-sections') ||
      url.includes('/admin/handbook')
    )) {
      return response;
    }
    
    logApiResponse(response);
    return response;
  };
  globalLoggerInstalled = true;
};

