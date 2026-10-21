// ============================================================
// MsLecturas — front/src/TomasDeEstado.jsx
// Formulario principal: listado, filtros, carga de lecturas
// ============================================================
import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { getLecturas, getCallesDeLecturas, actualizarLectura, getPendientesCount, getSinSyncCount, borrarTodasLasLecturas, getFechaTomaActual } from './db.js';
import { cargarRutaDesdeServidor } from './syncService.js';

function injectCSS() {
  if (document.getElementById('tomas-css')) return;
  const s = document.createElement('style');
  s.id = 'tomas-css';
  s.textContent = `
    .tomas-wrap{padding:14px;max-width:1100px;margin:0 auto}
    /* ---- Paneles ---- */
    .panel{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 6px rgba(0,0,0,.08);margin-bottom:14px}
    .panel-title{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:12px;display:flex;align-items:center;gap:8px}
    /* ---- Nueva ruta ---- */
    .ruta-row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
    .ruta-row input{flex:1;min-width:100px;padding:9px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;font-family:inherit;outline:none}
    .ruta-row input:focus{border-color:#1d4ed8;box-shadow:0 0 0 3px rgba(29,78,216,.10)}
    .fecha-row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-top:10px}
    .fecha-row label{font-size:12px;font-weight:600;color:#374151}
    .fecha-row input[type=date]{padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:13px;font-family:inherit;outline:none}
    .fecha-row input:focus{border-color:#1d4ed8}
    /* ---- Filtros ---- */
    .filtros-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px}
    .filt-label{font-size:11px;font-weight:600;color:#6b7280;margin-bottom:4px}
    .filt-input{width:100%;padding:7px 10px;border:1px solid #e5e7eb;border-radius:7px;font-size:13px;font-family:inherit;outline:none}
    .filt-input:focus{border-color:#1d4ed8}
    select.filt-input{background:#fff}
    /* ---- Tabla ---- */
    .tabla-wrap{overflow-x:auto;margin-top:4px}
    table{width:100%;border-collapse:collapse;font-size:12px}
    thead th{background:#0f172a;color:#f1f5f9;padding:9px 10px;text-align:left;white-space:nowrap;font-weight:600;position:sticky;top:0}
    tbody tr{border-bottom:1px solid #fff}
    /* Solo con mouse: en celulares el :hover queda "pegado" al tocar y el filter fuerza repintar la fila */
    @media(hover:hover){tbody tr:hover{filter:brightness(0.96)}}
    tbody td{padding:8px 10px;vertical-align:middle}
    td.mono{font-family:'IBM Plex Mono',monospace}
    /* Dirección y Cliente son el dato principal para el operador: fuente más grande, se lee sin scrollear */
    thead th:nth-child(1),thead th:nth-child(2){font-size:13px}
    tbody td:nth-child(1),tbody td:nth-child(2){font-size:15px;line-height:1.3;white-space:normal}
    /* Color de fila según sync_estado — reemplaza la columna Estado */
    tbody tr.tr-P{background:#fef3c7}   /* Sin lectura   → arena  */
    tbody tr.tr-U{background:#dbeafe}   /* Pend. sync    → celeste */
    tbody tr.tr-S{background:#dcfce7}   /* Sincronizado  → verde  */
    tbody tr.tr-C{background:#fee2e2}   /* Conflicto     → rojo   */
    /* Columna de acción siempre visible, aunque la tabla scrollee horizontalmente */
    thead th:last-child,tbody td:last-child{position:sticky;right:0}
    thead th:last-child{background:#0f172a}
    tbody tr.tr-P td:last-child{background:#fef3c7}
    tbody tr.tr-U td:last-child{background:#dbeafe}
    tbody tr.tr-S td:last-child{background:#dcfce7}
    tbody tr.tr-C td:last-child{background:#fee2e2}
    /* ---- Botones ---- */
    .btn{padding:7px 14px;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .2s}
    .btn-primary{background:#1d4ed8;color:#fff}
    .btn-primary:hover{background:#1e40af}
    .btn-primary:disabled{background:#9ca3af;cursor:not-allowed}
    .btn-success{background:#16a34a;color:#fff}
    .btn-success:hover{background:#15803d}
    .btn-sm{padding:4px 10px;font-size:11px}
    .btn-danger{background:#dc2626;color:#fff}
    .btn-danger:hover{background:#b91c1c}
    .btn-tab{padding:6px 12px;border:1px solid #d1d5db;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;background:#fff;color:#374151;font-family:inherit}
    .btn-tab.active{background:#0f172a;color:#fff;border-color:#0f172a}
    /* ---- Modal lectura ---- */
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
    .modal-card{background:#fff;border-radius:12px;width:100%;max-width:420px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,.2)}
    .modal-card h3{font-size:17px;font-weight:700;margin-bottom:16px;color:#0f172a}
    .field-group{margin-bottom:14px}
    .field-group label{display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:4px}
    .field-group input{width:100%;padding:11px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:17px;font-family:inherit;outline:none}
    .field-group input:focus{border-color:#1d4ed8;box-shadow:0 0 0 3px rgba(29,78,216,.10)}
    .field-group .hint{font-size:12px;color:#6b7280;margin-top:3px}
    .field-group .error{font-size:12px;color:#dc2626;margin-top:3px;font-weight:600}
    .consumo-preview{padding:9px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;font-size:15px;color:#166534;margin-bottom:14px;font-weight:600}
    .modal-footer{display:flex;gap:10px;justify-content:flex-end;margin-top:6px}
    .modal-footer .btn{font-size:14px;padding:10px 18px}
    .info-cliente{background:#f8fafc;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:14px;line-height:1.8}
    .info-cliente strong{color:#0f172a}
    /* ---- Vacío ---- */
    .empty-state{text-align:center;padding:48px 20px;color:#9ca3af}
    .empty-state .icon{font-size:40px;margin-bottom:10px}
    /* ---- Resumen ---- */
    .resumen-bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
    .res-item{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600}
    .res-pend{background:#fef3c7;color:#92400e}
    .res-sync{background:#dbeafe;color:#1e40af}
    .res-ok{background:#dcfce7;color:#166534}
    .res-conf{background:#fee2e2;color:#991b1b}
    /* ---- Responsive ---- */
    @media(max-width:480px){
      .filtros-grid{grid-template-columns:1fr}
      /* Columnas: 1 Dirección, 2 Cliente, 3 Medidor, 4 Lect.ant, 5 F.ant, 6 Lectura, 7 F.lectura, 8 Consumo, 9 Acción */
      thead th:nth-child(5),thead th:nth-child(7),thead th:nth-child(8),
      tbody td:nth-child(5),tbody td:nth-child(7),tbody td:nth-child(8){display:none}
      /* Dirección y Cliente ocupan todo el ancho visible; el resto (medidor, lecturas) queda a un scroll de distancia */
      thead th:nth-child(1),tbody td:nth-child(1){min-width:150px}
      thead th:nth-child(2),tbody td:nth-child(2){min-width:130px}
      thead th:nth-child(1),thead th:nth-child(2){font-size:14px}
      tbody td:nth-child(1),tbody td:nth-child(2){font-size:16px}
    }
    @media(min-width:481px) and (max-width:768px){
      .filtros-grid{grid-template-columns:1fr 1fr}
    }
  `;
  document.head.appendChild(s);
}

const ESTADOS = {
  P: { label: 'Sin lectura' },
  U: { label: 'Pend. sync' },
  S: { label: 'Sincronizado' },
  C: { label: 'Conflicto' },
};

function fmtFecha(v) {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d)) return v;
  // fecha_lectura se guarda como medianoche UTC del día calendario elegido:
  // hay que leerla en UTC, si no en zonas horarias negativas (AR) muestra el día anterior.
  return d.toLocaleDateString('es-AR', { timeZone: 'UTC' });
}

// Lecturas y consumos son siempre enteros (m³)
function fmtNum(v) {
  if (v == null) return '—';
  return Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 });
}

const PERIODICIDADES = { '': 'Todas', B: 'Bimestral', M: 'Mensual' };

// bis: char(1) en SQL Server — 1 = es bis, 0 o vacío = no es bis
function esBis(v) {
  return (v ?? '').toString().trim() === '1';
}

// ── Componente modal de carga de lectura ──────────────────
function ModalLectura({ registro, onGuardar, onCerrar }) {
  const [lectura, setLectura]     = useState('');
  const [errLec,  setErrLec]      = useState('');

  const consumo = lectura !== '' && registro.lectura_ant != null
    ? fmtNum(parseInt(lectura, 10) - Number(registro.lectura_ant))
    : null;

  const validar = () => {
    if (!/^\d+$/.test(lectura)) {
      setErrLec('Ingresá un número entero'); return false;
    }
    if (registro.lectura_ant != null && parseInt(lectura, 10) < Number(registro.lectura_ant)) {
      setErrLec(`No puede ser menor a la lectura anterior (${fmtNum(registro.lectura_ant)})`); return false;
    }
    setErrLec(''); return true;
  };

  const guardar = () => {
    if (!validar()) return;
    onGuardar(registro.local_id, parseInt(lectura, 10), registro.fecha_lectura);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCerrar()}>
      <div className="modal-card">
        <h3>📝 Cargar lectura</h3>

        <div className="info-cliente">
          <div><strong>{registro.denominacion_cliente || '—'}</strong></div>
          <div>{registro.denominacion_calle} {registro.altura}{esBis(registro.bis) ? ' bis' : ''}{registro.piso ? ` P${registro.piso}` : ''}{registro.depto ? ` D${registro.depto}` : ''}</div>
          <div>Medidor: <strong style={{ fontFamily: 'monospace' }}>{registro.numero_medidor}</strong></div>
          <div>Lect. anterior: <strong>{fmtNum(registro.lectura_ant)}</strong> — Fecha: {fmtFecha(registro.fecha_lectura_ant)}</div>
          <div>Fecha de lectura: <strong>{fmtFecha(registro.fecha_lectura)}</strong></div>
        </div>

        <div className="field-group">
          <label>Lectura actual *</label>
          {/* type="text" + inputMode="numeric": en iPhone type="number" no abre el teclado numérico */}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={lectura}
            onChange={e => { setLectura(e.target.value.replace(/\D/g, '')); setErrLec(''); }}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && guardar()}
            placeholder={`mín. ${fmtNum(registro.lectura_ant ?? 0)}`}
          />
          {errLec && <div className="error">{errLec}</div>}
        </div>

        {consumo !== null && (
          <div className="consumo-preview">
            Consumo calculado: <strong>{consumo} m³</strong>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-danger btn-sm" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-success" onClick={guardar}>Guardar lectura</button>
        </div>
      </div>
    </div>
  );
}

// ── Fila de la tabla ──────────────────────────────────────
// memo: al abrir el modal, guardar una lectura o refrescar contadores solo se
// redibujan las filas que cambiaron — con rutas de cientos de medidores es lo que
// hacía lento el botón en celulares de gama baja.
const FilaLectura = memo(function FilaLectura({ r, puedeModificar, onCargar }) {
  return (
    <tr className={`tr-${r.sync_estado}`}>
      <td style={{ fontWeight: 700 }}>{r.denominacion_calle || '—'} {r.altura}{esBis(r.bis) ? 'b' : ''}</td>
      <td style={{ fontWeight: 600 }}>{r.denominacion_cliente || '—'}</td>
      <td className="mono">{r.numero_medidor}</td>
      <td className="mono">{fmtNum(r.lectura_ant)}</td>
      <td>{fmtFecha(r.fecha_lectura_ant)}</td>
      <td className="mono" style={{ fontWeight: r.lectura != null ? 700 : 400, color: r.lectura != null ? '#166534' : '#9ca3af' }}>
        {fmtNum(r.lectura)}
      </td>
      <td>{fmtFecha(r.fecha_lectura)}</td>
      <td className="mono" style={{ color: r.consumo != null ? '#1d4ed8' : '#9ca3af' }}>
        {fmtNum(r.consumo)}
      </td>
      <td>
        {puedeModificar && (r.sync_estado === 'P' || r.sync_estado === 'U' || r.sync_estado === 'C') && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onCargar(r)}
          >
            {r.sync_estado === 'P' ? 'Cargar' : 'Editar'}
          </button>
        )}
      </td>
    </tr>
  );
});

// ── Componente principal ──────────────────────────────────
// online : estado de conexión (lo verifica App, una sola vez para toda la app)
// recarga: contador que App incrementa tras sincronizar, para refrescar la lista
export default function TomasDeEstado({ sesion, online, recarga, onCambio }) {
  injectCSS();

  const puedeModificar = sesion?.permite_modif === 'S';

  // ---- Panel "Modificar" (nueva toma de estado / borrar / exportar)
  const [modoModificar, setModoModificar] = useState(false);
  const [subAccion,     setSubAccion]     = useState('nueva'); // 'nueva' | 'borrar' | 'exportar'
  const [ruta,        setRuta]        = useState('');
  const [fechaGlobal, setFechaGlobal] = useState(() => new Date().toISOString().slice(0, 10));
  const [periodicidad, setPeriodicidad] = useState(''); // '' = todas | 'B' | 'M'
  const [fechaTomaActual, setFechaTomaActual] = useState(null); // fecha de la toma ya cargada en el dispositivo
  const [cargandoRuta,setCargandoRuta] = useState(false);
  const [msgRuta,     setMsgRuta]     = useState('');
  const [msgBorrar,   setMsgBorrar]   = useState('');
  const [msgExport,   setMsgExport]   = useState('');

  // ---- Filtros
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [calles,       setCalles]       = useState([]);
  const [filtCalle,    setFiltCalle]    = useState('');
  const [filtAltDesde, setFiltAltDesde] = useState('');
  const [filtAltHasta, setFiltAltHasta] = useState('');
  const [filtCliente,  setFiltCliente]  = useState('');
  const [filtEstado,   setFiltEstado]   = useState('');
  const [orden,        setOrden]        = useState('calle');

  // ---- Lista
  const [lista,     setLista]     = useState([]);
  // Solo la carga inicial muestra "Cargando...": en las siguientes se reemplaza
  // la lista sin desmontar la tabla, así no se pierde la posición del scroll
  const [cargando,  setCargando]  = useState(true);

  // Resumen de estados
  const resumen = useMemo(() => {
    const res = { P:0, U:0, S:0, C:0 };
    lista.forEach(r => { if (res[r.sync_estado] !== undefined) res[r.sync_estado]++; });
    return res;
  }, [lista]);

  // ---- Modal lectura
  const [modalReg,  setModalReg]  = useState(null);

  // Cargar lista con filtros
  const cargarLista = useCallback(async () => {
    try {
      const arr = await getLecturas({
        calle:       filtCalle    || undefined,
        alturaDesde: filtAltDesde || undefined,
        alturaHasta: filtAltHasta || undefined,
        cliente:     filtCliente  || undefined,
        estado:      filtEstado   || undefined,
        orden,
      });
      setLista(arr);

      // Calles presentes en la toma de estado actual (cualquier sync_estado)
      setCalles(await getCallesDeLecturas());

      // Si ya hay una toma de estado cargada, la fecha queda fija en la de esa toma
      const fechaToma = await getFechaTomaActual();
      setFechaTomaActual(fechaToma);
      if (fechaToma) setFechaGlobal(fechaToma);
    } finally {
      setCargando(false);
    }
  }, [filtCalle, filtAltDesde, filtAltHasta, filtCliente, filtEstado, orden]);

  useEffect(() => { cargarLista(); }, [cargarLista, recarga]);

  // ---- Cargar nueva ruta desde servidor
  const handleCargarRuta = async () => {
    if (!ruta.trim())        { setMsgRuta('Ingresá el código de ruta'); return; }
    if (!online)             { setMsgRuta('Se necesita conexión al servidor'); return; }
    if (!fechaGlobal)        { setMsgRuta('Ingresá la fecha de lectura'); return; }
    if (!sesion?.empleado)   { setMsgRuta('El usuario no tiene número de empleado asignado'); return; }
    if (fechaTomaActual && !window.confirm(
      `Ya hay una toma de estado cargada con fecha ${fmtFecha(fechaTomaActual)}.\n\n` +
      `Si continuás, los medidores de esta ruta se agregarán a esa misma toma de estado.\n\n` +
      `Si es una toma de estado nueva, cancelá y borrá antes las lecturas.`
    )) return;

    setCargandoRuta(true);
    setMsgRuta('');
    try {
      // Se pasa: ruta, empleado (de la sesión), fechaLectura ingresada por el usuario
      const total = await cargarRutaDesdeServidor(
        ruta.trim(),
        sesion.empleado,
        fechaGlobal,
        periodicidad,
        (msg) => setMsgRuta(msg)
      );
      setMsgRuta(`✓ ${total} medidores cargados (${PERIODICIDADES[periodicidad].toLowerCase()}) para el ${fmtFecha(fechaGlobal)}`);
      setRuta('');
      cargarLista();
      onCambio?.();
    } catch (e) {
      setMsgRuta('✗ ' + e.message);
    } finally {
      setCargandoRuta(false);
    }
  };

  // ---- Borrar todas las lecturas locales
  const handleBorrarTodo = async () => {
    const advertencia = resumen.U > 0
      ? `¡ATENCIÓN! Hay ${resumen.U} lecturas sin sincronizar que se van a PERDER. ¿Borrar de todas formas las ${lista.length} lecturas cargadas en este dispositivo?`
      : `¿Borrar las ${lista.length} lecturas cargadas en este dispositivo? Esta acción no se puede deshacer.`;
    if (!window.confirm(advertencia)) return;

    await borrarTodasLasLecturas();
    setMsgBorrar('✓ Lecturas borradas');
    cargarLista();
    onCambio?.();
  };

  // ---- Exportar lecturas a texto (respaldo manual si no se puede sincronizar)
  const handleExportar = async () => {
    const arr = await getLecturas({});
    if (arr.length === 0) { setMsgExport('No hay lecturas para exportar'); return; }

    const headers = ['Estado','Medidor','Cliente','Calle','Altura','LecturaAnterior','FechaAnterior','Lectura','FechaLectura','Consumo','CodigoRuta','LocalId'];
    const filas = arr.map(r => [
      ESTADOS[r.sync_estado]?.label || r.sync_estado,
      r.numero_medidor,
      r.denominacion_cliente || '',
      `${r.denominacion_calle || ''} ${r.altura || ''}${esBis(r.bis) ? ' bis' : ''}`.trim(),
      r.altura ?? '',
      r.lectura_ant ?? '',
      fmtFecha(r.fecha_lectura_ant),
      r.lectura ?? '',
      fmtFecha(r.fecha_lectura),
      r.consumo ?? '',
      r.codigo_ruta ?? '',
      r.local_id,
    ].join('\t'));

    const contenido = [headers.join('\t'), ...filas].join('\n');
    const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
    const url  = document.createElement('a');
    url.href = URL.createObjectURL(blob);
    url.download = `lecturas_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(url);
    url.click();
    url.remove();
    URL.revokeObjectURL(url.href);

    setMsgExport(`✓ Exportadas ${arr.length} lecturas`);
  };

  // ---- Guardar lectura
  // Reemplaza solo la fila guardada (no relee ni redibuja toda la ruta)
  const handleGuardarLectura = async (local_id, lectura, fecha_lectura) => {
    const actualizado = await actualizarLectura(local_id, lectura, fecha_lectura);
    setModalReg(null);
    setLista(prev => filtEstado && actualizado.sync_estado !== filtEstado
      ? prev.filter(r => r.local_id !== local_id)
      : prev.map(r => r.local_id === local_id ? actualizado : r));
    onCambio?.();
  };

  return (
    <div className="tomas-wrap">

      {/* ---- Panel Modificar (nueva toma de estado / borrar / exportar) ---- */}
      <div className="panel">
        <div className="panel-title">
          🔥 Tomas de Estados
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              className={`btn btn-sm ${modoModificar ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => { setModoModificar(!modoModificar); setSubAccion('nueva'); setMsgRuta(''); setMsgBorrar(''); setMsgExport(''); }}
            >
              {modoModificar ? '✕ Cerrar' : '⚙ Modificar'}
            </button>
          </div>
        </div>

        {modoModificar && (
          <div>
            {/* Sub-navegación */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button className={`btn-tab ${subAccion === 'nueva'    ? 'active' : ''}`} onClick={() => setSubAccion('nueva')}>+ Nueva toma de estado</button>
              <button className={`btn-tab ${subAccion === 'borrar'   ? 'active' : ''}`} onClick={() => setSubAccion('borrar')}>🗑 Borrar lecturas</button>
              <button className={`btn-tab ${subAccion === 'exportar' ? 'active' : ''}`} onClick={() => setSubAccion('exportar')}>⬇ Exportar</button>
            </div>

            {/* ---- Nueva toma de estado ---- */}
            {subAccion === 'nueva' && (
              <div>
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#eff6ff', borderRadius: 8, fontSize: 12, color: '#1e40af' }}>
                  👤 <strong>{sesion?.denominacion || sesion?.usuario}</strong>
                  {sesion?.empleado ? ` — Empleado N° ${sesion.empleado}` : ' ⚠ Sin número de empleado asignado'}
                </div>

                {!online && (
                  <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fef3c7', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                    ⚠ Sin conexión al servidor. Conectate a la red para poder cargar una ruta.
                  </div>
                )}

                {fechaTomaActual && (
                  <div style={{ marginBottom: 10, padding: '8px 12px', background: '#fef3c7', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
                    ⚠ Ya hay una toma de estado cargada con fecha <strong>{fmtFecha(fechaTomaActual)}</strong>. Si continuás, la ruta se agregará a esa misma toma de estado.
                    Si es una toma de estado <strong>nueva</strong>, primero borrá las lecturas desde <strong>🗑 Borrar lecturas</strong>.
                  </div>
                )}

                <div className="ruta-row">
                  <div>
                    <div className="filt-label">Código de ruta *</div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={ruta}
                      onChange={e => setRuta(e.target.value.replace(/\D/g, ''))}
                      placeholder="ej. 1001"
                      onKeyDown={e => e.key === 'Enter' && handleCargarRuta()}
                    />
                  </div>
                  <div>
                    <div className="filt-label">Periodicidad</div>
                    <select
                      value={periodicidad}
                      onChange={e => setPeriodicidad(e.target.value)}
                      style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: '#fff' }}
                    >
                      {Object.entries(PERIODICIDADES).map(([v, label]) => (
                        <option key={v} value={v}>{label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="filt-label">Fecha de lectura *</div>
                    <input
                      type="date"
                      value={fechaGlobal}
                      onChange={e => setFechaGlobal(e.target.value)}
                      disabled={!!fechaTomaActual}
                      style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: fechaTomaActual ? '#f3f4f6' : '#fff' }}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleCargarRuta}
                    disabled={cargandoRuta}
                    style={{ alignSelf: 'flex-end' }}
                  >
                    {cargandoRuta ? '⏳ Cargando...' : 'Cargar ruta'}
                  </button>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: '#6b7280' }}>
                  Se cargarán los medidores de la ruta asignados a este empleado. Si ya tenías lecturas cargadas en esta ruta y están sincronizadas, se reemplazarán. La fecha ingresada quedará como fecha de lectura en todos los registros.
                </div>
                {msgRuta && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 13,
                    background: msgRuta.startsWith('✓') ? '#f0fdf4' : msgRuta.startsWith('✗') ? '#fef2f2' : '#eff6ff',
                    color:      msgRuta.startsWith('✓') ? '#166534' : msgRuta.startsWith('✗') ? '#dc2626' : '#1d4ed8',
                  }}>
                    {msgRuta}
                  </div>
                )}
              </div>
            )}

            {/* ---- Borrar lecturas ---- */}
            {subAccion === 'borrar' && (
              <div>
                <div style={{ marginBottom: 12, padding: '10px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                  ⚠ Esto borra <strong>todas</strong> las lecturas cargadas en este dispositivo ({lista.length} registros{resumen.U > 0 ? `, ${resumen.U} sin sincronizar` : ''}). No se puede deshacer.
                </div>
                <button className="btn btn-danger" onClick={handleBorrarTodo} disabled={lista.length === 0}>
                  🗑 Borrar todas las lecturas
                </button>
                {msgBorrar && <div style={{ marginTop: 10, fontSize: 13, color: '#166534' }}>{msgBorrar}</div>}
              </div>
            )}

            {/* ---- Exportar a texto ---- */}
            {subAccion === 'exportar' && (
              <div>
                <div style={{ marginBottom: 12, fontSize: 12, color: '#6b7280' }}>
                  Descarga un archivo de texto con todas las lecturas cargadas en este dispositivo (pendientes y sincronizadas). Sirve como respaldo manual si no podés sincronizar.
                </div>
                <button className="btn btn-success" onClick={handleExportar} disabled={lista.length === 0}>
                  ⬇ Exportar a texto
                </button>
                {msgExport && <div style={{ marginTop: 10, fontSize: 13, color: '#166534' }}>{msgExport}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Panel Filtros ---- */}
      <div className="panel">
        <div className="panel-title">
          🔍 Filtros
          <button
            className="btn btn-sm btn-primary"
            style={{ marginLeft: 'auto' }}
            onClick={() => setMostrarFiltros(v => !v)}
          >
            {mostrarFiltros ? '▲ Ocultar' : '▼ Mostrar'}
          </button>
        </div>
        {mostrarFiltros && (
          <div className="filtros-grid">
            <div>
              <div className="filt-label">Calle</div>
              <select className="filt-input" value={filtCalle} onChange={e => setFiltCalle(e.target.value)}>
                <option value="">— Todas —</option>
                {calles.map(c => (
                  <option key={c.codigo} value={c.codigo}>{c.denominacion}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="filt-label">Altura desde</div>
              <input type="number" className="filt-input" value={filtAltDesde} onChange={e => setFiltAltDesde(e.target.value)} placeholder="ej. 100" />
            </div>
            <div>
              <div className="filt-label">Altura hasta</div>
              <input type="number" className="filt-input" value={filtAltHasta} onChange={e => setFiltAltHasta(e.target.value)} placeholder="ej. 999" />
            </div>
            <div>
              <div className="filt-label">Cliente</div>
              <input type="text" className="filt-input" value={filtCliente} onChange={e => setFiltCliente(e.target.value)} placeholder="nombre..." />
            </div>
            <div>
              <div className="filt-label">Estado</div>
              <select className="filt-input" value={filtEstado} onChange={e => setFiltEstado(e.target.value)}>
                <option value="">— Todos —</option>
                <option value="P">Sin lectura</option>
                <option value="U">Pend. sincronizar</option>
                <option value="S">Sincronizado</option>
                <option value="C">Conflicto</option>
              </select>
            </div>
            <div>
              <div className="filt-label">Ordenar por</div>
              <select className="filt-input" value={orden} onChange={e => setOrden(e.target.value)}>
                <option value="calle">Calle + Altura</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ---- Resumen ---- */}
      {lista.length > 0 && (
        <div className="resumen-bar">
          <span className="res-item res-pend">📋 Sin lectura: {resumen.P}</span>
          <span className="res-item res-sync">⏳ Pend. sync: {resumen.U}</span>
          <span className="res-item res-ok">✓ Sync: {resumen.S}</span>
          {resumen.C > 0 && <span className="res-item res-conf">⚠ Conflictos: {resumen.C}</span>}
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>
            {lista.length} registros
          </span>
        </div>
      )}

      {/* ---- Tabla ---- */}
      <div className="panel" style={{ padding: '12px 0' }}>
        {cargando ? (
          <div style={{ textAlign:'center', padding: 32, color:'#6b7280' }}>Cargando...</div>
        ) : lista.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📋</div>
            <div>No hay lecturas</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {online ? 'Cargá una nueva toma de estado desde el botón de arriba' : 'Sin conexión al servidor — cargá una ruta cuando estés conectado'}
            </div>
          </div>
        ) : (
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Dirección</th>
                  <th>Cliente</th>
                  <th>Medidor</th>
                  <th>Lect. ant.</th>
                  <th>F. ant.</th>
                  <th>Lectura</th>
                  <th>F. lectura</th>
                  <th>Consumo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lista.map(r => (
                  <FilaLectura key={r.local_id} r={r} puedeModificar={puedeModificar} onCargar={setModalReg} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Modal de carga de lectura ---- */}
      {modalReg && (
        <ModalLectura
          registro={modalReg}
          onGuardar={handleGuardarLectura}
          onCerrar={() => setModalReg(null)}
        />
      )}
    </div>
  );
}
