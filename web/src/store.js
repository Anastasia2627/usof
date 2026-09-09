import { createStore } from 'redux';

function readStoredAuth() {
  try {
    return JSON.parse(localStorage.getItem('usof-auth') || 'null');
  } catch {
    localStorage.removeItem('usof-auth');
    return null;
  }
}

const initialState = {
  auth: readStoredAuth(),
};

function reducer(state = initialState, action) {
  switch (action.type) {
    case 'AUTH_SET':
      localStorage.setItem('usof-auth', JSON.stringify(action.payload));
      return { ...state, auth: action.payload };
    case 'AUTH_PATCH': {
      if (!state.auth) return state;
      const auth = { ...state.auth, ...action.payload };
      localStorage.setItem('usof-auth', JSON.stringify(auth));
      return { ...state, auth };
    }
    case 'AUTH_USER_SET': {
      if (!state.auth) return state;
      const auth = { ...state.auth, user: action.payload };
      localStorage.setItem('usof-auth', JSON.stringify(auth));
      return { ...state, auth };
    }
    case 'AUTH_CLEAR':
      localStorage.removeItem('usof-auth');
      return { ...state, auth: null };
    default:
      return state;
  }
}

export const store = createStore(reducer);
