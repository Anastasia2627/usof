import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store.js';
import App from './App.jsx';
import { PreferencesProvider } from './preferences.jsx';
import './basic.css';
import './threads.css';
import './feature-additions.css';
import './refined-pages.css';

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <PreferencesProvider><App /></PreferencesProvider>
  </Provider>,
);
