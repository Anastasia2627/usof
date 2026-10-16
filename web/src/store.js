import { createStore } from 'redux';

// Preview sessions are never reused by the real API (and vice versa).
const AUTH_STORAGE_KEY = import.meta.env.MODE === 'demo' ? 'circle-demo-auth' : 'usof-auth';

function readStoredAuth() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_STORAGE_KEY) || 'null');
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

const initialState = {
  auth: readStoredAuth(),
};

function reducer(state = initialState, action) {
  switch (action.type) {
    case 'AUTH_SET':
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(action.payload));
      return { ...state, auth: action.payload };
    case 'AUTH_PATCH': {
      if (!state.auth) return state;
      const auth = { ...state.auth, ...action.payload };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
      return { ...state, auth };
    }
    case 'AUTH_USER_SET': {
      if (!state.auth) return state;
      const auth = { ...state.auth, user: action.payload };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
      return { ...state, auth };
    }
    case 'AUTH_CLEAR':
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return { ...state, auth: null };
    default:
      return state;
  }
}

export const store = createStore(reducer);
