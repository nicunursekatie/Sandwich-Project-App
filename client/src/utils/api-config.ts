/**
 * Get the API base URL for making requests to the backend server
 * In development, this will use the server port (3001) or environment variable
 * In production, this will use the configured API base URL or current origin
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  // Use environment variable if set
  const envApiUrl = import.meta.env.VITE_API_BASE_URL;
  if (envApiUrl) {
    return envApiUrl;
  }

  const location = window.location;
  const hostname = location.hostname || 'localhost';
  
  // In development, connect to the backend server port (3001)
  // In production, use the current origin (assuming same host)
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    const serverPort = import.meta.env.VITE_SERVER_PORT || '3001';
    return `${location.protocol}//${hostname}:${serverPort}`;
  }

  // In production, use current origin
  return location.origin;
}

/**
 * Get the Socket.IO server URL
 */
export function getSocketIoUrl(): string {
  return getApiBaseUrl();
}

