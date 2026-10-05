// ============================================================
// MsLecturas — routes/status.js
// GET /api/status
// ============================================================
import { Router } from 'express';
import { getPool } from '../server.js';

const router = Router();

// ── GET /api/status ───────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const db = await getPool();
    await db.request().query('SELECT 1 AS ok');
    res.json({ ok: true, ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

export default router;
