// ============================================================
// MsLecturas — front/src/main.jsx
// ============================================================
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';

// Registro del Service Worker (PWA)
// registerType 'autoUpdate' (vite.config.js): una versión nueva se activa sola y
// la página se recarga, sin preguntar. El chequeo de versión ocurre al abrir o
// recargar la app, así que la recarga pasa en los primeros segundos y no en
// medio de una carga de lectura (lo ya guardado vive en Dexie, no se pierde).
registerSW({
  onOfflineReady() {
    console.log('App lista para uso offline');
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
