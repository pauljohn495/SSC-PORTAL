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
    logApiResponse(response);
    return response;
  };
  globalLoggerInstalled = true;
};

