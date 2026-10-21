// ============================================================
// MsLecturas — front/src/main.jsx
// ============================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';

// Registro del Service Worker (PWA)
// En modo 'prompt' el SW nuevo queda "en espera" mientras la app esté abierta:
// un reload() simple sigue usando el viejo y vuelve a preguntar en loop.
// updateSW() le pide al nuevo que se active (SKIP_WAITING) y la página se
// recarga sola cuando éste toma el control.
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nueva versión disponible. ¿Actualizar ahora?')) {
      updateSW(true);
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
