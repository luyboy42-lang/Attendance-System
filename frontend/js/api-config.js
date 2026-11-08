// When opened directly from disk, use the local Express server for API requests.
// When served by Express or another host, keep API calls on the current origin.
window.API_BASE_URL = window.location.protocol === 'file:'
  ? 'http://localhost:5000'
  : window.location.origin;

window.apiUrl = (path) => `${window.API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
