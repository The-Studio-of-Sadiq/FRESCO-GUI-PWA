import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {installLocalApiFallback} from './utils/localApiFallback';
import './index.css';

// Serve /api/* in the browser (FRESCO compiled to WebAssembly) when there is no
// Express backend: static hosting such as Vercel, or offline use of the PWA.
installLocalApiFallback();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
