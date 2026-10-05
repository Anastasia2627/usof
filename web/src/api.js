import { mockApi } from './mockApi.js';

const ORIGIN = (import.meta.env.VITE_API_ORIGIN || 'http://localhost:5000').replace(/\/$/, '');
const BASE = `${ORIGIN}/api`;
let previewFallbackActive = false;

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
  return `${ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function isPreviewMode() {
  return Boolean(import.meta.env.DEV && previewFallbackActive);
}

export async function api(path, { method = 'GET', body, token, formData, signal } = {}) {
  if (import.meta.env.DEV && previewFallbackActive) {
    return mockApi(path, { method, body, token, formData, signal });
  }

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !formData) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
      signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;

    if (import.meta.env.DEV) {
      previewFallbackActive = true;
      window.dispatchEvent(new CustomEvent('circle:preview-mode'));
      return mockApi(path, { method, body, token, formData, signal });
    }

    throw new ApiError('Cannot reach the Circle API. Check that the backend is running.', {
      code: 'NETWORK_ERROR',
    });
  }

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data?.error?.message || `Request failed with status ${response.status}`, {
      status: response.status,
      code: data?.error?.code || 'REQUEST_FAILED',
      details: data?.error?.details || null,
    });
  }
  return data;
}
