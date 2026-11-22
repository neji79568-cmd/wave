import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './library.css';
import './product.css';
import './style.css';
import './wave.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
