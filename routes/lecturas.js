// ============================================================
// MsLecturas — routes/lecturas.js
// GET  /api/lecturas/ruta/:codigoRuta
// POST /api/lecturas/sync/upload
// GET  /api/lecturas/sync/download
// ============================================================
import { Router } from 'express';
import { getPool } from '../server.js';
import sql from 'mssql';

const router = Router();

// ── GET /api/lecturas/ruta/:codigoRuta ────────────────────
// Carga medidores de una ruta filtrados por empleado_toma_estado
// Query params: empleado (obligatorio), fechaLectura (obligatorio)
// La fechaLectura ingresada por el usuario se usa como fecha_lectura en se_lecturas
router.get('/lecturas/ruta/:codigoRuta', async (req, res) => {
  const { codigoRuta } = req.params;
  const { empleado, fechaLectura } = req.query;

  if (!empleado) {
    return res.status(400).json({ error: 'Parámetro empleado requerido' });
  }
  if (!fechaLectura) {
    return res.status(400).json({ error: 'Parámetro fechaLectura requerido' });
  }

  try {
    const db = await getPool();
    const result = await db.request()
      .input('ruta',     sql.Numeric,  codigoRuta)
      .input('empleado', sql.Numeric,  empleado)
      .query(`
        SELECT
          m.servicio,
          m.medidor                    AS numero_medidor,
          m.numero_propietario         AS numero_cliente,
          COALESCE(c.denominacion, m.denominacion_propietario, '') AS denominacion_cliente,
          m.codigo_calle,
          m.altura,
          m.piso,
          m.depto,
          m.numero_usuario,
          m.ultima_medicion            AS lectura_ant,
          m.fecha_medicion_anterior    AS fecha_lectura_ant,
          m.periodicidad,
          m.codigo_ruta,
          m.sub_categoria,
          m.numero_residente,
          m.bis,
          m.carpeta,
          m.manzana,
          m.orden_planilla,
          m.seccion_im,
          m.tipo_servicio,
          COALESCE(ca.denominacion, '') AS denominacion_calle,
          m.empleado_toma_estado
        FROM dbo.se_medidores m
        LEFT JOIN dbo.Clientes c   ON c.numero  = m.numero_propietario
        LEFT JOIN dbo.se_calles ca ON ca.codigo = m.codigo_calle
        WHERE m.codigo_ruta          = @ruta
          AND m.empleado_toma_estado = @empleado
          AND m.estado               = 'A'
        ORDER BY ca.denominacion, m.altura, m.bis
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({
        error: `No hay medidores activos para la ruta ${codigoRuta} asignados al empleado ${empleado}`,
      });
    }

    res.json(result.recordset);
  } catch (err) {
    console.error('lecturas/ruta:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/lecturas/sync/upload ────────────────────────
// Recibe array de lecturas pendientes desde el celular y las guarda
router.post('/lecturas/sync/upload', async (req, res) => {
  const { lecturas } = req.body;
  if (!Array.isArray(lecturas) || lecturas.length === 0)
    return res.status(400).json({ error: 'Sin datos' });

  const db = await getPool();
  const resultados = [];

  for (const l of lecturas) {
    try {
      // Verificar si ya existe por local_id (idempotente)
      const existe = await db.request()
        .input('local_id', sql.VarChar(50), l.local_id)
        .query(`SELECT numero_id, sync_version FROM dbo.se_lecturas WHERE local_id = @local_id`);

      if (existe.recordset.length > 0) {
        const srv = existe.recordset[0];
        // Detectar conflicto: versión del servidor mayor
        if (srv.sync_version > l.sync_version) {
          resultados.push({ local_id: l.local_id, estado: 'conflicto', numero_id: srv.numero_id });
          continue;
        }
        // Actualizar
        await db.request()
          .input('local_id',      sql.VarChar(50),   l.local_id)
          .input('lectura',       sql.Numeric(12,1),  l.lectura)
          .input('fecha_lectura', sql.DateTime,       new Date(l.fecha_lectura))
          .input('consumo',       sql.Numeric(12,1),  l.consumo)
          .input('sync_version',  sql.Int,            (l.sync_version || 1) + 1)
          .input('sync_origen',   sql.VarChar(50),    l.sync_origen)
          .query(`
            UPDATE dbo.se_lecturas SET
              lectura            = @lectura,
              fecha_lectura      = @fecha_lectura,
              consumo            = @consumo,
              estado_lectura     = 'P',  
              sync_estado        = 'S',
              sync_version       = @sync_version,
              sync_origen        = @sync_origen,
              sync_fecha         = GETDATE(),
              fecha_modificacion = GETDATE()
            WHERE local_id = @local_id
          `);
        resultados.push({ local_id: l.local_id, estado: 'actualizado', numero_id: srv.numero_id });
        continue;
      }

      // No se encontró por local_id (puede pasar si el operador recargó la ruta
      // en el dispositivo y se generó un local_id nuevo para un medidor que ya
      // tenía lectura sincronizada). Antes de insertar, buscar por clave natural
      // (medidor + ruta + misma fecha de lectura) para no duplicar la fila.
      const existeNatural = await db.request()
        .input('numero_medidor', sql.Numeric(10,0), l.numero_medidor)
        .input('codigo_ruta',    sql.Numeric(8,0),  l.codigo_ruta)
        .input('fecha_lectura',  sql.DateTime,      new Date(l.fecha_lectura))
        .query(`
          SELECT numero_id, sync_version FROM dbo.se_lecturas
          WHERE numero_medidor = @numero_medidor
            AND codigo_ruta    = @codigo_ruta
            AND CAST(fecha_lectura AS DATE) = CAST(@fecha_lectura AS DATE)
        `);

      if (existeNatural.recordset.length > 0) {
        const srv = existeNatural.recordset[0];
        await db.request()
          .input('numero_id',     sql.Int,            srv.numero_id)
          .input('local_id',      sql.VarChar(50),    l.local_id)
          .input('lectura',       sql.Numeric(12,1),  l.lectura)
          .input('consumo',       sql.Numeric(12,1),  l.consumo)
          .input('sync_version',  sql.Int,            (srv.sync_version || 1) + 1)
          .input('sync_origen',   sql.VarChar(50),    l.sync_origen)
          .query(`
            UPDATE dbo.se_lecturas SET
              local_id           = @local_id,
              lectura            = @lectura,
              consumo            = @consumo,
              estado_lectura     = 'P',  
              sync_estado        = 'S',
              sync_version       = @sync_version,
              sync_origen        = @sync_origen,
              sync_fecha         = GETDATE(),
              fecha_modificacion = GETDATE()
            WHERE numero_id = @numero_id
          `);
        resultados.push({ local_id: l.local_id, estado: 'actualizado', numero_id: srv.numero_id });
      } else {
        // INSERT nuevo
        const ins = await db.request()
          .input('servicio',            sql.Numeric(4,0),    l.servicio)
          .input('numero_medidor',      sql.Numeric(10,0),   l.numero_medidor)
          .input('numero_cliente',      sql.Numeric(10,0),   l.numero_cliente)
          .input('denominacion_cliente',sql.VarChar(45),     l.denominacion_cliente)
          .input('codigo_calle',        sql.Numeric(8,0),    l.codigo_calle)
          .input('altura',              sql.Numeric(8,0),    l.altura)
          .input('piso',                sql.Char(2),         l.piso || '')
          .input('depto',               sql.Char(2),         l.depto || '')
          .input('numero_usuario',      sql.VarChar(20),     l.numero_usuario)
          .input('fecha_lectura',       sql.DateTime,        new Date(l.fecha_lectura))
          .input('lectura',             sql.Numeric(12,1),   l.lectura)
          .input('fecha_lectura_ant',   sql.DateTime,        l.fecha_lectura_ant ? new Date(l.fecha_lectura_ant) : null)
          .input('lectura_ant',         sql.Numeric(12,1),   l.lectura_ant)
          .input('consumo',             sql.Numeric(12,1),   l.consumo)
          .input('estado_lectura',      sql.VarChar(1),      'P') 
          .input('periodicidad',        sql.VarChar(1),      l.periodicidad)
          .input('codigo_ruta',         sql.Numeric(8,0),    l.codigo_ruta)
          .input('sub_categoria',       sql.VarChar(10),     l.sub_categoria)
          .input('bis',                 sql.Char(1),         l.bis || '')
          .input('carpeta',             sql.VarChar(10),     l.carpeta)
          .input('manzana',             sql.VarChar(10),     l.manzana)
          .input('orden_planilla',      sql.Numeric(6,0),    l.orden_planilla)
          .input('seccion_im',          sql.VarChar(5),      l.seccion_im)
          .input('tipo_servicio',       sql.VarChar(2),      l.tipo_servicio)
          .input('denominacion_calle',  sql.VarChar(40),     l.denominacion_calle)
          .input('empleado',            sql.Numeric(8,0),    l.empleado)
          .input('local_id',            sql.VarChar(50),     l.local_id)
          .input('sync_origen',         sql.VarChar(50),     l.sync_origen)
          .query(`
            INSERT INTO dbo.se_lecturas (
              servicio, numero_medidor, numero_cliente, denominacion_cliente,
              codigo_calle, altura, piso, depto, numero_usuario,
              fecha_lectura, lectura, fecha_lectura_ant, lectura_ant, consumo,estado_lectura,
              periodicidad, codigo_ruta, sub_categoria, bis, carpeta, manzana,
              orden_planilla, seccion_im, tipo_servicio, denominacion_calle,
              empleado, local_id, sync_estado, sync_origen, sync_fecha, sync_version,
              fecha_modificacion
            ) OUTPUT INSERTED.numero_id
            VALUES (
              @servicio, @numero_medidor, @numero_cliente, @denominacion_cliente,
              @codigo_calle, @altura, @piso, @depto, @numero_usuario,
              @fecha_lectura, @lectura, @fecha_lectura_ant, @lectura_ant, @consumo,@estado_lectura,
              @periodicidad, @codigo_ruta, @sub_categoria, @bis, @carpeta, @manzana,
              @orden_planilla, @seccion_im, @tipo_servicio, @denominacion_calle,
              @empleado, @local_id, 'S', @sync_origen, GETDATE(), 1,
              GETDATE()
            )
          `);
        const numero_id = ins.recordset[0].numero_id;
        resultados.push({ local_id: l.local_id, estado: 'insertado', numero_id });
      }
    } catch (err) {
      console.error('upload error local_id', l.local_id, err.message);
      resultados.push({ local_id: l.local_id, estado: 'error', error: err.message });
    }
  }

  res.json({ ok: true, resultados });
});

// ── GET /api/lecturas/sync/download ──────────────────────
// Trae lecturas modificadas en el servidor desde una fecha
router.get('/lecturas/sync/download', async (req, res) => {
  const { desde, ruta } = req.query;
  try {
    const db = await getPool();
    const req2 = db.request();
    let whereExtra = '';
    if (desde) {
      req2.input('desde', sql.DateTime, new Date(desde));
      whereExtra += ' AND sync_fecha >= @desde';
    }
    if (ruta) {
      req2.input('ruta', sql.Numeric, ruta);
      whereExtra += ' AND codigo_ruta = @ruta';
    }
    const result = await req2.query(`
      SELECT * FROM dbo.se_lecturas
      WHERE 1=1 ${whereExtra}
      ORDER BY denominacion_calle, altura
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('sync/download:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
