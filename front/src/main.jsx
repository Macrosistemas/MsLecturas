// ============================================================
// MsLecturas — front/src/main.jsx
// ============================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';

// Registro del Service Worker (PWA)
registerSW({
  onNeedRefresh() {
    if (confirm('Nueva versión disponible. ¿Actualizar ahora?')) {
      window.location.reload();
    }
  },
  onOfflineReady() {
    console.log('App lista para uso offline');
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
