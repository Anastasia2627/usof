import { mockApi } from './mockApi.js';

// In local Vite development, the browser calls its own origin. Vite proxies
// /api and /uploads to Node on the APP_PORT configured in the root .env. Production still uses the
// configured API origin, so the app can be deployed separately.
const ORIGIN = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_ORIGIN || window.location.origin).replace(/\/$/, '');
const BASE = ORIGIN + '/api';

const demoMode = import.meta.env.DEV && import.meta.env.MODE === 'demo';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'REQUEST_FAILED', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return ORIGIN + (path.startsWith('/') ? '' : '/') + path;
}
export function isDemoMode() { return demoMode; }
export function isPreviewMode() { return demoMode; }

export async function api(path, { method = 'GET', body, token, formData, signal } = {}) {
  if (demoMode) return mockApi(path, { method, body, token, formData, signal });

  const headers = {};
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(BASE + path, {
      method,
      headers,
      body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(
      'Cannot connect to Circle right now. Check that npm start is running, then retry.',
      { code: 'NETWORK_ERROR' },
    );
  }

  if (response.status === 204) return null;
  let data;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError('Circle API did not return JSON. Check APP_PORT in .env and restart both npm start and npm run web.', {
        status: response.status, code: 'API_UNAVAILABLE',
      });
    }
    throw new ApiError('Unexpected response from Circle API.', {
      status: response.status, code: 'INVALID_API_RESPONSE',
    });
  }
  if (!response.ok) {
    throw new ApiError(data?.error?.message || 'Request failed with status ' + response.status, {
      status: response.status,
      code: data?.error?.code || 'REQUEST_FAILED',
      details: data?.error?.details || null,
    });
  }
  return data;
}
