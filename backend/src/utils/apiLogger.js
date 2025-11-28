export const setApiLogHeader = (res, logData) => {
  if (!res || typeof res.setHeader !== 'function') {
    return;
  }

  const payload = {
    method: logData.method,
    endpoint: logData.endpoint,
    status: logData.status,
    message: logData.message || null,
  };

  if (logData.content !== undefined) {
    payload.content = logData.content;
  }

  try {
    let headerValue = JSON.stringify(payload);

    // Remove unprintable characters and normalize whitespace to keep header safe
    headerValue = headerValue.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
    headerValue = headerValue.replace(/[\r\n\t]/g, ' ');
    headerValue = headerValue.replace(/\s{2,}/g, ' ').trim();

    res.setHeader('X-API-Log', headerValue);
  } catch (error) {
    console.error('Failed to set X-API-Log header:', error);
  }
};


