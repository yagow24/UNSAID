import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Service Worker Management: Only register in production; unregister in local development
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          if (reg.installing) {
            console.log('[UNSAID PWA] Service worker installing');
          } else if (reg.active) {
            console.log('[UNSAID PWA] Service worker active and caching');
          }
        })
        .catch((err) => {
          console.warn('[UNSAID PWA] Service worker registration failed:', err);
        });
    });
  } else {
    // In development mode, proactively unregister any stale service workers to prevent stale module caching
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then(() => {
          console.log('[UNSAID Dev] Unregistered lingering development service worker');
        });
      }
    });
    // Clean up development caches
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      });
    }
  }
}
