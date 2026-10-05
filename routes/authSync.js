// ============================================================
// MsLecturas — routes/authSync.js
// POST /api/auth/login
// GET  /api/sync/status
// POST /api/sync/log
// ============================================================
import { Router } from 'express';
import { getPool } from '../server.js';
import sql from 'mssql';

const router = Router();

// ── POST /api/auth/login ──────────────────────────────────
router.post('/auth/login', async (req, res) => {
  const { usuario, clave } = req.body;
  if (!usuario || !clave)
    return res.status(400).json({ error: 'Faltan credenciales' });

  try {
    const db = await getPool();
    const result = await db.request()
      .input('usuario', sql.VarChar(10), usuario.trim().toLowerCase())
      .input('clave',   sql.VarChar(20), clave)
      .query(`
        SELECT usuario, denominacion, tipo_de_usuario,
               permite_altas, permite_bajas, permite_modif,
               empleado, clave
        FROM dbo.usuarios
        WHERE LOWER(usuario) = @usuario
          AND clave = @clave
      `);

    if (result.recordset.length === 0)
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

    const u = result.recordset[0];
    // No devolver la clave en texto plano
    delete u.clave;
    res.json({ ok: true, usuario: u });
  } catch (err) {
    console.error('auth/login:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/sync/status ──────────────────────────────────
router.get('/sync/status', async (req, res) => {
  try {
    const db = await getPool();
    await db.request().query('SELECT 1');
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false });
  }
});

// ── POST /api/sync/log ────────────────────────────────────
router.post('/sync/log', async (req, res) => {
  const { usuario, tipo, detalle, fecha } = req.body;
  try {
    const db = await getPool();
    await db.request()
      .input('usuario', sql.VarChar(10),  usuario || 'sistema')
      .input('tipo',    sql.VarChar(50),  tipo    || 'sync')
      .input('detalle', sql.VarChar(500), detalle || '')
      .input('fecha',   sql.DateTime,     fecha ? new Date(fecha) : new Date())
      .query(`
        INSERT INTO dbo.sync_log_app (usuario, tipo, detalle, fecha)
        VALUES (@usuario, @tipo, @detalle, @fecha)
      `);
    res.json({ ok: true });
  } catch (err) {
    // No fatal — el log es opcional
    console.warn('sync/log (no fatal):', err.message);
    res.json({ ok: true, warn: err.message });
  }
});

export default router;
