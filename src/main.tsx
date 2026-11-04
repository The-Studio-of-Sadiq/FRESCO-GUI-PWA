import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {installLocalApiFallback} from './utils/localApiFallback';
import './index.css';

// Serve /api/* in the browser (FRESCO compiled to WebAssembly) when there is no
// Express backend: static hosting such as Vercel, or offline use of the PWA.
installLocalApiFallback();

// Offline support for production builds. In development the service worker would
// cache Vite's modules and serve stale code, so remove any earlier registration.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => console.warn('[PWA] Service worker registration failed:', err));
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
