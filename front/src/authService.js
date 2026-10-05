// ============================================================
// MsLecturas — front/src/authService.js
// Login online/offline, sync de parámetros, logout
// ============================================================
import CryptoJS from 'crypto-js';
import {
  guardarSesion, limpiarSesion, getSesionActiva,
  guardarUsuariosLocal, getUsuarioLocal,
  guardarLookups, db,
} from './db.js';

const API = import.meta.env.VITE_API_URL || 'https://localhost:3443/api';
const SALT = 'MsLecturas_2025_salt';

// ── Utilidades ────────────────────────────────────────────
export function hashClave(clave) {
  return CryptoJS.SHA256(SALT + clave).toString();
}

export function isOnline() {
  return navigator.onLine;
}

export async function puedeAlcanzarServidor() {
  try {
    const res = await fetch(`${API}/sync/status`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Login principal ───────────────────────────────────────
export async function login(usuario, clave) {
  const online = await puedeAlcanzarServidor();
  if (online) {
    return loginOnline(usuario, clave);
  } else {
    return loginOffline(usuario, clave);
  }
}

// ── Login Online ──────────────────────────────────────────
export async function loginOnline(usuario, clave) {
  const res = await fetch(`${API}/auth/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ usuario: usuario.trim().toLowerCase(), clave }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error de autenticación');
  }

  const { usuario: u } = await res.json();

  // Guardar usuario local con hash de clave para login offline
  await guardarUsuariosLocal([{
    ...u,
    usuario:      usuario.trim().toLowerCase(),
    clave_hash:   hashClave(clave),
  }]);

  const sesion = {
    ...u,
    modo_login:   'online',
    fecha_login:  new Date().toISOString(),
  };
  await guardarSesion(sesion);

  // Sincronizar parámetros (lookups)
  await sincronizarParametros();

  return sesion;
}

// ── Login Offline ─────────────────────────────────────────
export async function loginOffline(usuario, clave) {
  const u = await getUsuarioLocal(usuario.trim().toLowerCase());
  if (!u) throw new Error('Sin datos locales. Conectate al servidor para el primer login.');

  const hash = hashClave(clave);
  if (u.clave_hash !== hash) throw new Error('Contraseña incorrecta');

  const sesion = {
    ...u,
    modo_login:  'offline',
    fecha_login: new Date().toISOString(),
  };
  await guardarSesion(sesion);
  return sesion;
}

// ── Sincronizar Parámetros (lookups) ─────────────────────
export async function sincronizarParametros() {
  const res = await fetch(`${API}/lookups/calles`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Error descargando calles');
  const calles = await res.json();
  await guardarLookups('calles', calles);

  // Marcar timestamp de última sync de parámetros
  await db.sesion.update('actual', {
    ultima_sync_params: new Date().toISOString(),
  });

  return { calles: calles.length };
}

/** Verifica si los parámetros tienen más de 1 hora y deben re-sincronizarse */
export async function parametrosVencidos() {
  const sesion = await getSesionActiva();
  if (!sesion?.ultima_sync_params) return true;
  const diff = Date.now() - new Date(sesion.ultima_sync_params).getTime();
  return diff > 60 * 60 * 1000; // 1 hora
}

// ── Logout ────────────────────────────────────────────────
export async function logout() {
  await limpiarSesion();
}

export { getSesionActiva };
