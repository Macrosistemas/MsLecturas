// ============================================================
// MsLecturas — routes/lookups.js
// GET /api/lookups/calles
// ============================================================
import { Router } from 'express';
import { getPool } from '../server.js';

const router = Router();

// ── GET /api/lookups/calles ───────────────────────────────
router.get('/lookups/calles', async (req, res) => {
  try {
    const db = await getPool();
    const result = await db.request().query(`
      SELECT codigo, denominacion, altura_inicial, altura_final
      FROM dbo.se_calles
      ORDER BY denominacion
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error('lookups/calles:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
