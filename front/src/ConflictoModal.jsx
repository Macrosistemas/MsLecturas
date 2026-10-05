// ============================================================
// MsLecturas — front/src/ConflictoModal.jsx
// Modal de resolución de conflictos de sincronización
// ============================================================
import { resolverConflicto } from './syncService.js';

function injectCSS() {
  if (document.getElementById('conflicto-css')) return;
  const s = document.createElement('style');
  s.id = 'conflicto-css';
  s.textContent = `
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px}
    .modal-box{background:#fff;border-radius:12px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;box-shadow:0 8px 40px rgba(0,0,0,.2)}
    .modal-header{padding:18px 20px 14px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px}
    .modal-header h2{font-size:16px;font-weight:700;color:#dc2626;flex:1}
    .modal-body{padding:20px}
    .conflicto-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
    @media(max-width:480px){.conflicto-grid{grid-template-columns:1fr}}
    .conflicto-col{border:1px solid #e5e7eb;border-radius:8px;padding:14px}
    .conflicto-col.mi{border-color:#1d4ed8;background:#eff6ff}
    .conflicto-col.srv{border-color:#dc2626;background:#fff5f5}
    .conflicto-col h3{font-size:12px;font-weight:700;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}
    .conflicto-col.mi h3{color:#1d4ed8}
    .conflicto-col.srv h3{color:#dc2626}
    .campo-row{margin-bottom:6px;font-size:12px}
    .campo-label{font-weight:600;color:#6b7280;margin-bottom:1px}
    .campo-val{padding:4px 8px;border-radius:4px;background:#f3f4f6;font-family:'IBM Plex Mono',monospace}
    .campo-val.diff{background:#fef08a;font-weight:600}
    .modal-footer{padding:14px 20px;border-top:1px solid #e5e7eb;display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
    .btn-mi{padding:9px 18px;background:#1d4ed8;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
    .btn-srv{padding:9px 18px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
    .btn-despues{padding:9px 18px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
  `;
  document.head.appendChild(s);
}

const CAMPOS_MOSTRAR = [
  { key: 'denominacion_cliente', label: 'Cliente' },
  { key: 'denominacion_calle',   label: 'Calle' },
  { key: 'altura',               label: 'Altura' },
  { key: 'lectura_ant',          label: 'Lectura anterior' },
  { key: 'fecha_lectura_ant',    label: 'Fecha lect. ant.' },
  { key: 'lectura',              label: 'Lectura' },
  { key: 'fecha_lectura',        label: 'Fecha lectura' },
  { key: 'consumo',              label: 'Consumo' },
  { key: 'sync_version',         label: 'Versión sync' },
];

function fmtVal(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'string' && v.includes('T')) {
    const d = new Date(v);
    if (!isNaN(d)) return d.toLocaleDateString('es-AR', { timeZone: 'UTC' });
  }
  return String(v);
}

export default function ConflictoModal({ registro, versionServidor, onResuelta, onPosponer }) {
  injectCSS();

  const handleResolver = async (usarMi) => {
    await resolverConflicto(registro.local_id, usarMi);
    onResuelta?.();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <span>⚠️</span>
          <h2>Conflicto de sincronización</h2>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            El servidor tiene una versión más reciente. Elegí cuál conservar.
            Los campos diferentes están marcados en amarillo.
          </p>
          <div className="conflicto-grid">
            <div className="conflicto-col mi">
              <h3>📱 Mi versión (celular)</h3>
              {CAMPOS_MOSTRAR.map(({ key, label }) => {
                const diff = versionServidor && fmtVal(registro[key]) !== fmtVal(versionServidor[key]);
                return (
                  <div className="campo-row" key={key}>
                    <div className="campo-label">{label}</div>
                    <div className={`campo-val ${diff ? 'diff' : ''}`}>{fmtVal(registro[key])}</div>
                  </div>
                );
              })}
            </div>
            <div className="conflicto-col srv">
              <h3>🖥️ Versión servidor</h3>
              {CAMPOS_MOSTRAR.map(({ key, label }) => {
                const diff = versionServidor && fmtVal(registro[key]) !== fmtVal(versionServidor[key]);
                return (
                  <div className="campo-row" key={key}>
                    <div className="campo-label">{label}</div>
                    <div className={`campo-val ${diff ? 'diff' : ''}`}>
                      {fmtVal(versionServidor?.[key])}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-despues" onClick={onPosponer}>Resolver después</button>
          <button className="btn-srv"     onClick={() => handleResolver(false)}>Usar versión SERVIDOR</button>
          <button className="btn-mi"      onClick={() => handleResolver(true)}>Usar MI versión</button>
        </div>
      </div>
    </div>
  );
}
