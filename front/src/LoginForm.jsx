// ============================================================
// MsLecturas — front/src/LoginForm.jsx
// Pantalla de login con indicador online/offline
// ============================================================
import { useState, useEffect } from 'react';
import { login, puedeAlcanzarServidor } from './authService.js';
import { getPendientesCount, getSinSyncCount } from './db.js';

function injectCSS() {
  if (document.getElementById('login-css')) return;
  const s = document.createElement('style');
  s.id = 'login-css';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600;700&display=swap');
    :root {
      --primary:#1d4ed8; --success:#16a34a; --danger:#dc2626;
      --warn:#f59e0b; --bg:#f0f2f5; --surface:#fff; --muted:#6b7280;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'IBM Plex Sans',sans-serif;background:var(--bg);min-height:100vh;display:flex;align-items:center;justify-content:center}
    .login-wrap{width:100%;max-width:400px;padding:16px}
    .login-card{background:var(--surface);border-radius:12px;padding:32px 28px;box-shadow:0 4px 24px rgba(0,0,0,.10)}
    .login-logo{text-align:center;margin-bottom:24px}
    .login-logo h1{font-size:22px;font-weight:700;color:var(--primary);margin-bottom:4px}
    .login-logo p{font-size:12px;color:var(--muted)}
    .badge-online{display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;margin-bottom:20px}
    .badge-online.on{background:#dcfce7;color:#16a34a}
    .badge-online.off{background:#fee2e2;color:#dc2626}
    .dot{width:8px;height:8px;border-radius:50%;background:currentColor}
    label{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:4px;margin-top:14px}
    input[type=text],input[type=password]{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;outline:none;transition:border .2s}
    input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(29,78,216,.12)}
    .btn-login{width:100%;margin-top:22px;padding:12px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .2s}
    .btn-login:hover{background:#1e40af}
    .btn-login:disabled{background:#9ca3af;cursor:not-allowed}
    .error-msg{margin-top:14px;padding:10px 12px;background:#fee2e2;color:#dc2626;border-radius:8px;font-size:13px}
    .info-box{margin-top:14px;padding:10px 12px;background:#fef3c7;color:#92400e;border-radius:8px;font-size:12px;line-height:1.5}
    .spinner{display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;margin-right:8px;vertical-align:middle}
    @keyframes spin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
}

export default function LoginForm({ onLogin }) {
  injectCSS();

  const [usuario,   setUsuario]   = useState('');
  const [clave,     setClave]     = useState('');
  const [online,    setOnline]    = useState(false);
  const [cargando,  setCargando]  = useState(false);
  const [error,     setError]     = useState('');
  const [sinDatos,  setSinDatos]  = useState(false);

  // Verificar conexión al servidor (no solo navigator.onLine)
  useEffect(() => {
    let activo = true;
    const verificar = async () => {
      const ok = await puedeAlcanzarServidor();
      if (activo) setOnline(ok);
    };
    verificar();
    const iv = setInterval(verificar, 5000);
    return () => { activo = false; clearInterval(iv); };
  }, []);

  // Verificar si hay datos locales (para aviso offline)
  useEffect(() => {
    (async () => {
      const p = await getPendientesCount();
      const s = await getSinSyncCount();
      setSinDatos(p === 0 && s === 0);
    })();
  }, []);

  const handleSubmit = async () => {
    setError('');
    if (!usuario.trim() || !clave.trim()) {
      setError('Ingresá usuario y contraseña');
      return;
    }
    setCargando(true);
    try {
      const sesion = await login(usuario, clave);
      onLogin(sesion);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  };

  const onKey = (e) => { if (e.key === 'Enter') handleSubmit(); };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <h1>🔥 MsLecturas</h1>
          <p>Tomas de Estados — Consumos de Gas</p>
        </div>

        <div style={{ textAlign: 'center' }}>
          <span className={`badge-online ${online ? 'on' : 'off'}`}>
            <span className="dot" />
            {online ? 'Conectado al servidor' : 'Sin conexión al servidor'}
          </span>
        </div>

        {!online && sinDatos && (
          <div className="info-box">
            ⚠️ No hay datos locales guardados. Conectate al servidor para el primer inicio de sesión.
          </div>
        )}

        <label>Usuario</label>
        <input
          type="text"
          value={usuario}
          onChange={e => setUsuario(e.target.value)}
          onKeyDown={onKey}
          autoCapitalize="none"
          autoComplete="username"
          placeholder="usuario"
        />

        <label>Contraseña</label>
        <input
          type="password"
          value={clave}
          onChange={e => setClave(e.target.value)}
          onKeyDown={onKey}
          autoComplete="current-password"
          placeholder="••••••••"
        />

        {error && <div className="error-msg">⚠ {error}</div>}

        <button className="btn-login" onClick={handleSubmit} disabled={cargando}>
          {cargando && <span className="spinner" />}
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </div>
    </div>
  );
}
