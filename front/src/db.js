// ============================================================
// MsLecturas — front/src/db.js
// Dexie (IndexedDB) — base de datos local offline-first
// ============================================================
import Dexie from 'dexie';

export const db = new Dexie('MsLecturasDB');

db.version(1).stores({
  // Sesión activa (siempre clave 'actual')
  sesion: 'clave',

  // Copia local de usuarios para login offline
  usuarios: 'usuario',

  // Lookups para combos (calles, etc.)
  // [tipo+codigo] = índice compuesto único
  lookups: '[tipo+codigo], tipo',

  // Tabla principal de datos
  // local_id = PK local (UUID offline)
  se_lecturas: 'local_id, sync_estado, codigo_calle, altura, denominacion_cliente, codigo_ruta',

  // Cola de operaciones pendientes de subir
  sync_queue: '++id, local_id, tipo, operacion, sync_estado, fecha_creacion',

  // Log de sincronizaciones
  sync_log: '++id, fecha, tipo',
});

// ── Helpers de Sesión ─────────────────────────────────────
export async function guardarSesion(usuario) {
  await db.sesion.put({ clave: 'actual', ...usuario });
}

export async function getSesionActiva() {
  return db.sesion.get('actual');
}

export async function limpiarSesion() {
  await db.sesion.delete('actual');
}

// ── Helpers de Lookups ────────────────────────────────────
export async function guardarLookups(tipo, registros) {
  const items = registros.map(r => ({ tipo, codigo: r.codigo, ...r }));
  await db.lookups.bulkPut(items);
}

export async function getLookups(tipo) {
  return db.lookups.where('tipo').equals(tipo).toArray();
}

export async function getLookupByCode(tipo, codigo) {
  return db.lookups.get([tipo, codigo]);
}

// ── Helpers de Usuarios ───────────────────────────────────
export async function guardarUsuariosLocal(usuarios) {
  await db.usuarios.bulkPut(usuarios);
}

export async function getUsuarioLocal(usuario) {
  return db.usuarios.get(usuario);
}

// ── Helpers de Lecturas ───────────────────────────────────

/** Genera local_id único: loc_timestamp_random */
export function generarLocalId() {
  return `loc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Inserta un registro con estado P (pendiente de cargar lectura) */
export async function insertarLectura(datos) {
  const local_id = datos.local_id || generarLocalId();
  await db.se_lecturas.put({
    ...datos,
    local_id,
    sync_estado:  datos.sync_estado  || 'P',  // P = pendiente de lectura
    sync_version: datos.sync_version || 1,
    sync_origen:  datos.sync_origen  || getDeviceId(),
    sync_fecha:   null,
  });
  return local_id;
}

/** Actualiza lectura y fecha_lectura → pone sync_estado='U' (pendiente sync) */
export async function actualizarLectura(local_id, lectura, fecha_lectura) {
  const reg = await db.se_lecturas.get(local_id);
  if (!reg) throw new Error('Registro no encontrado: ' + local_id);

  const consumo = lectura - (reg.lectura_ant || 0);
  await db.se_lecturas.update(local_id, {
    lectura,
    fecha_lectura,
    consumo,
    sync_estado: 'U',   // U = actualizado localmente, pendiente de subir
  });

  // Encolar para sync
  await encolarOperacion(local_id, 'se_lecturas', 'UPDATE');
}

/** Carga masiva de lecturas de una ruta (limpia antes).
 *  fechaLectura: string YYYY-MM-DD ingresado por el usuario.
 *  Se asigna directamente como fecha_lectura en cada registro
 *  (el empleado ya fue usado en el servidor para filtrar por empleado_toma_estado).
 */
export async function cargarLecturasRuta(registros, codigoRuta, fechaLectura) {
  // Borra lecturas pendientes de esta ruta solo si no hay sin sincronizar
  const pendientesSync = await db.se_lecturas
    .where('sync_estado').equals('U')
    .and(r => r.codigo_ruta == codigoRuta)
    .count();

  if (pendientesSync > 0) {
    throw new Error(
      `Hay ${pendientesSync} lecturas pendientes de sincronizar en esta ruta. Sincronizá antes de cargar nuevos datos.`
    );
  }

  // Elimina lecturas anteriores de la ruta
  await db.se_lecturas
    .where('codigo_ruta').equals(codigoRuta)
    .delete();

  // Convertir la fecha ingresada a ISO para almacenamiento uniforme
  const fechaISO = fechaLectura
    ? new Date(fechaLectura).toISOString()
    : new Date().toISOString();

  // Inserta todas con sync_estado='P' (pendiente de cargar lectura)
  // fecha_lectura viene definida por el usuario desde la pantalla de sincronizacion
  const items = registros.map(r => ({
    ...r,
    local_id:      generarLocalId(),
    sync_estado:   'P',
    sync_version:  1,
    sync_origen:   getDeviceId(),
    sync_fecha:    null,
    lectura:       null,
    fecha_lectura: fechaISO,
    consumo:       null,
  }));
  await db.se_lecturas.bulkPut(items);
  return items.length;
}

/** Lista lecturas con filtros opcionales */
export async function getLecturas({ calle, alturaDesde, alturaHasta, cliente, estado, orden } = {}) {
  let col = db.se_lecturas.toCollection();

  if (estado)     col = col.filter(r => r.sync_estado === estado);
  if (calle)      col = col.filter(r => r.codigo_calle == calle);
  if (cliente)    col = col.filter(r => (r.denominacion_cliente || '').toLowerCase().includes(cliente.toLowerCase()));
  if (alturaDesde) col = col.filter(r => (r.altura || 0) >= Number(alturaDesde));
  if (alturaHasta) col = col.filter(r => (r.altura || 0) <= Number(alturaHasta));

  let arr = await col.toArray();

  // Ordenamiento
  if (orden === 'cliente') {
    arr.sort((a, b) => (a.denominacion_cliente || '').localeCompare(b.denominacion_cliente || ''));
  } else {
    // Default: calle + altura
    arr.sort((a, b) => {
      const ca = (a.denominacion_calle || '').localeCompare(b.denominacion_calle || '');
      if (ca !== 0) return ca;
      return (a.altura || 0) - (b.altura || 0);
    });
  }

  return arr;
}

/** Calles distintas presentes en las lecturas cargadas localmente (para el filtro) */
export async function getCallesDeLecturas() {
  const arr = await db.se_lecturas.toArray();
  const mapa = new Map();
  arr.forEach(r => {
    if (r.codigo_calle != null && !mapa.has(r.codigo_calle)) {
      mapa.set(r.codigo_calle, r.denominacion_calle || '');
    }
  });
  return [...mapa.entries()]
    .map(([codigo, denominacion]) => ({ codigo, denominacion }))
    .sort((a, b) => a.denominacion.localeCompare(b.denominacion));
}

/** Conteo de pendientes de cargar (P) */
export async function getPendientesCount() {
  return db.se_lecturas.where('sync_estado').equals('P').count();
}

/** Conteo de pendientes de sincronizar (U) */
export async function getSinSyncCount() {
  return db.se_lecturas.where('sync_estado').equals('U').count();
}

/** Conteo de conflictos (C) */
export async function getConflictosCount() {
  return db.se_lecturas.where('sync_estado').equals('C').count();
}

/** Borra TODAS las lecturas locales y su cola de sync — irreversible */
export async function borrarTodasLasLecturas() {
  await db.se_lecturas.clear();
  await db.sync_queue.clear();
}

// ── Helpers de Sync Queue ─────────────────────────────────
export async function encolarOperacion(local_id, tipo, operacion) {
  // Evitar duplicados — eliminar cola previa del mismo registro
  await db.sync_queue
    .where('local_id').equals(local_id)
    .delete();

  await db.sync_queue.add({
    local_id,
    tipo,
    operacion,
    sync_estado:    'pendiente',
    fecha_creacion: new Date().toISOString(),
  });
}

export async function getPendientesQueue() {
  return db.sync_queue.where('sync_estado').equals('pendiente').toArray();
}

export async function marcarQueueProcesado(id) {
  await db.sync_queue.update(id, { sync_estado: 'procesado' });
}

export async function limpiarQueueProcesados() {
  await db.sync_queue.where('sync_estado').equals('procesado').delete();
}

// ── Device ID ─────────────────────────────────────────────
export function getDeviceId() {
  let id = localStorage.getItem('ms_device_id');
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem('ms_device_id', id);
  }
  return id;
}
