// ============================================================
// MsLecturas — front/src/App.jsx
// Raíz: sesión, barra sync sticky, contadores, logout
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import LoginForm        from './LoginForm.jsx';
import TomasDeEstado    from './TomasDeEstado.jsx';
import ConflictoModal   from './ConflictoModal.jsx';
import { getSesionActiva, logout } from './authService.js';
import { getPendientesCount, getSinSyncCount, getConflictosCount, db } from './db.js';
import { sincronizar, verificarConexion } from './syncService.js';

function injectCSS() {
  if (document.getElementById('app-css')) return;
  const s = document.createElement('style');
  s.id = 'app-css';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
    :root{--primary:#1d4ed8;--success:#16a34a;--danger:#dc2626;--warn:#f59e0b;--bg:#f0f2f5;--surface:#fff;--muted:#6b7280}
    *{box-sizing:border-box;margin:0;padding:0}
    html,body{overflow-x:hidden;max-width:100vw}
    body{font-family:'IBM Plex Sans',sans-serif;background:var(--bg);min-height:100vh}
    .topbar{position:sticky;top:0;z-index:100;background:#0f172a;color:#f1f5f9;display:flex;align-items:center;gap:8px;padding:0 14px;height:52px;box-shadow:0 2px 8px rgba(0,0,0,.3)}
    .topbar-title{font-weight:700;font-size:15px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dot-status{width:8px;height:8px;border-radius:50%;flex-shrink:0}
    .dot-status.on{background:#22c55e}
    .dot-status.off{background:#ef4444}
    .badge-count{display:inline-flex;align-items:center;justify-content:center;min-width:20px;height:20px;border-radius:10px;font-size:11px;font-weight:700;padding:0 5px;flex-shrink:0}
    .badge-pend{background:#fef3c7;color:#92400e}
    .badge-sync{background:#dbeafe;color:#1e40af}
    .badge-conf{background:#fee2e2;color:#dc2626}
    .btn-topbar{padding:5px 12px;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .2s;white-space:nowrap;flex-shrink:0}
    .btn-sync{background:#1d4ed8;color:#fff}
    .btn-sync:hover{background:#1e40af}
    .btn-sync:disabled{background:#334155;cursor:not-allowed}
    .btn-logout{background:#374151;color:#d1d5db}
    .btn-logout:hover{background:#dc2626;color:#fff}
    .sync-msg{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#0f172a;color:#f1f5f9;padding:10px 20px;border-radius:8px;font-size:13px;z-index:999;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.3)}
    .spinner-sm{display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;margin-right:6px;vertical-align:middle}
    @keyframes spin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
}

export default function App() {
  injectCSS();

  const [sesion,       setSesion]       = useState(null);
  const [iniciando,    setIniciando]    = useState(true);
  const [online,       setOnline]       = useState(false);
  const [sincronizando,setSincronizando] = useState(false);
  const [syncMsg,      setSyncMsg]      = useState('');
  const [contadores,   setContadores]   = useState({ pend: 0, sync: 0, conf: 0 });
  const [conflictos,   setConflictos]   = useState([]);
  const [recarga,      setRecarga]      = useState(0); // se incrementa para que TomasDeEstado relea la lista

  // Restaurar sesión al arrancar
  useEffect(() => {
    (async () => {
      const s = await getSesionActiva();
      if (s) setSesion(s);
      setIniciando(false);
    })();
  }, []);

  // Verificar conexión cada 5s
  useEffect(() => {
    let activo = true;
    const verificar = async () => {
      const ok = await verificarConexion();
      if (activo) setOnline(ok);
    };
    verificar();
    const iv = setInterval(verificar, 5000);
    return () => { activo = false; clearInterval(iv); };
  }, []);

  // Actualizar contadores
  const actualizarContadores = useCallback(async () => {
    const [pend, sync, conf] = await Promise.all([
      getPendientesCount(),
      getSinSyncCount(),
      getConflictosCount(),
    ]);
    // Si nada cambió se devuelve el mismo objeto/array: React no re-renderiza
    // y la tabla de lecturas no se redibuja cada 8s
    setContadores(prev =>
      prev.pend === pend && prev.sync === sync && prev.conf === conf ? prev : { pend, sync, conf });

    // Cargar conflictos para mostrar modal
    const conflReg = conf > 0
      ? await db.se_lecturas.where('sync_estado').equals('C').toArray()
      : [];
    const claveConfl = arr => arr.map(r => `${r.local_id}:${r.sync_version}`).join('|');
    setConflictos(prev => claveConfl(prev) === claveConfl(conflReg) ? prev : conflReg);
  }, []);

  useEffect(() => {
    if (!sesion) return;
    actualizarContadores();
    const iv = setInterval(actualizarContadores, 8000);
    return () => clearInterval(iv);
  }, [sesion, actualizarContadores]);

  const handleSync = async () => {
    if (syncEnCurso) return;
    setSincronizando(true);
    setSyncMsg('Sincronizando...');
    try {
      const res = await sincronizar((msg) => setSyncMsg(msg));
      setSyncMsg(`✓ Subidos: ${res.subidos}  Conflictos: ${res.conflictos}`);
      actualizarContadores();
      setRecarga(n => n + 1);
    } catch (e) {
      setSyncMsg('✗ ' + e.message);
    } finally {
      setSincronizando(false);
      setTimeout(() => setSyncMsg(''), 4000);
    }
  };

  const handleLogout = async () => {
    if (contadores.sync > 0) {
      const ok = window.confirm(
        `Hay ${contadores.sync} lecturas pendientes de sincronizar. ¿Salir de todas formas?`
      );
      if (!ok) return;
    }
    await logout();
    setSesion(null);
  };

  if (iniciando) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'#6b7280' }}>
        Cargando...
      </div>
    );
  }

  if (!sesion) {
    return <LoginForm onLogin={(s) => setSesion(s)} />;
  }

  return (
    <>
      {/* Barra superior sticky */}
      <div className="topbar">
        <span className={`dot-status ${online ? 'on' : 'off'}`} title={online ? 'Servidor conectado' : 'Sin conexión'} />
        <span className="topbar-title">MsLecturas</span>

        {contadores.pend > 0 && (
          <span className="badge-count badge-pend" title="Pendientes de cargar">
            📋 {contadores.pend}
          </span>
        )}
        {contadores.sync > 0 && (
          <span className="badge-count badge-sync" title="Pendientes de sincronizar">
            ⏳ {contadores.sync}
          </span>
        )}
        {contadores.conf > 0 && (
          <span className="badge-count badge-conf" title="Conflictos">
            ⚠ {contadores.conf}
          </span>
        )}

        <button
          className="btn-topbar btn-sync"
          onClick={handleSync}
          disabled={sincronizando || !online}
          title={!online ? 'Sin conexión al servidor' : 'Sincronizar ahora'}
        >
          {sincronizando && <span className="spinner-sm" />}
          {sincronizando ? 'Sync...' : '⟳ Sync'}
        </button>

        <button className="btn-topbar btn-logout" onClick={handleLogout}>
          Salir
        </button>
      </div>

      {/* Contenido principal */}
      <TomasDeEstado
        sesion={sesion}
        online={online}
        recarga={recarga}
        onCambio={actualizarContadores}
      />

      {/* Mensaje de sync flotante */}
      {syncMsg && <div className="sync-msg">{syncMsg}</div>}

      {/* Modal de conflictos */}
      {conflictos.length > 0 && (
        <ConflictoModal
          registro={conflictos[0]}
          versionServidor={null}
          onResuelta={() => { actualizarContadores(); setRecarga(n => n + 1); }}
          onPosponer={() => setConflictos([])}
        />
      )}
    </>
  );
}

let syncEnCurso = false;
