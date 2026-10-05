// ============================================================
// MsLecturas — front/src/syncService.js
// Sincronización bidireccional celular ↔ servidor
// ============================================================
import {
  db, getPendientesQueue, marcarQueueProcesado,
  limpiarQueueProcesados, getDeviceId, getSesionActiva,
} from './db.js';

const API = import.meta.env.VITE_API_URL || 'https://localhost:3443/api';

let syncEnCurso = false;

// ── Estado de conexión al servidor ───────────────────────
export async function verificarConexion() {
  try {
    const res = await fetch(`${API}/sync/status`, {
      cache:  'no-store',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Carga de Lecturas desde Servidor (nueva ruta) ─────────
// empleado    : usuarios.empleado del usuario logueado
//               filtra se_medidores.empleado_toma_estado
// fechaLectura: fecha ingresada por el usuario (YYYY-MM-DD)
//               se asigna directamente como fecha_lectura en cada registro
export async function cargarRutaDesdeServidor(codigoRuta, empleado, fechaLectura, onProgreso) {
  const params = new URLSearchParams({ empleado, fechaLectura });
  const res = await fetch(`${API}/lecturas/ruta/${codigoRuta}?${params}`, {
    cache: 'no-store',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error al cargar ruta ${codigoRuta}`);
  }
  const registros = await res.json();
  if (!registros.length) throw new Error('La ruta no tiene medidores activos para este empleado');

  onProgreso?.(`Cargando ${registros.length} medidores...`);

  // Importar aquí para evitar circular
  const { cargarLecturasRuta } = await import('./db.js');
  // fechaLectura se pasa para asignarse en cada registro como fecha_lectura
  const total = await cargarLecturasRuta(registros, codigoRuta, fechaLectura);
  return total;
}

// ── Sync Principal ────────────────────────────────────────
export async function sincronizar(onProgreso) {
  if (syncEnCurso) return { ok: false, msg: 'Sync ya en curso' };
  syncEnCurso = true;

  const resultado = { subidos: 0, conflictos: 0, errores: 0 };

  try {
    const conectado = await verificarConexion();
    if (!conectado) throw new Error('Sin conexión al servidor');

    const sesion = await getSesionActiva();

    // 1. SUBIDA — lecturas con sync_estado='U' (actualizadas localmente)
    const pendientes = await db.se_lecturas
      .where('sync_estado').equals('U')
      .toArray();

    if (pendientes.length > 0) {
      onProgreso?.(`Subiendo ${pendientes.length} lecturas...`);

      const payload = pendientes.map(l => ({
        ...l,
        sync_origen: getDeviceId(),
        empleado:    sesion?.empleado,
      }));

      const res = await fetch(`${API}/lecturas/sync/upload`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ lecturas: payload }),
      });

      if (!res.ok) {
        const detalle = await res.text().catch(() => '');
        throw new Error(`Error en subida al servidor (HTTP ${res.status})${detalle ? ': ' + detalle.slice(0, 200) : ''}`);
      }
      const { resultados } = await res.json();

      for (const r of resultados) {
        if (r.estado === 'conflicto') {
          await db.se_lecturas.update(r.local_id, { sync_estado: 'C' });
          resultado.conflictos++;
        } else if (r.estado === 'error') {
          resultado.errores++;
        } else {
          const reg = await db.se_lecturas.get(r.local_id);
          await db.se_lecturas.update(r.local_id, {
            sync_estado:  'S',
            sync_fecha:   new Date().toISOString(),
            sync_version: (reg?.sync_version || 1) + 1,
          });
          resultado.subidos++;
        }
      }
    }

    // 2. Log de sync
    await fetch(`${API}/sync/log`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        usuario: sesion?.usuario,
        tipo:    'sync_lecturas',
        detalle: JSON.stringify(resultado),
        fecha:   new Date().toISOString(),
      }),
    }).catch(() => {});

    await limpiarQueueProcesados();
    onProgreso?.('Sync completado');

  } catch (err) {
    resultado.error = err.message;
    throw err;
  } finally {
    syncEnCurso = false;
  }

  return resultado;
}

// ── Resolver Conflicto ────────────────────────────────────
export async function resolverConflicto(local_id, usarMiVersion) {
  const reg = await db.se_lecturas.get(local_id);
  if (!reg) throw new Error('Registro no encontrado');

  if (usarMiVersion) {
    await db.se_lecturas.update(local_id, {
      sync_estado:  'U',
      sync_version: (reg.sync_version || 1) + 1,
    });
  } else {
    await db.se_lecturas.update(local_id, { sync_estado: 'S' });
  }
}
