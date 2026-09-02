const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function getApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${cleanPath}` : cleanPath;
}

export function apiFetch(path, init) {
  return fetch(getApiUrl(path), init);
}
