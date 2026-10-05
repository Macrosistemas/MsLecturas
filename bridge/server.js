// ============================================================
// MsLecturas — bridge/server.js
// Corre en el VPS. Sirve el front y reenvia cualquier /api/*
// hacia el agente local via long-polling saliente (patron
// "agente con long-polling" — ver docs/deployment-agente-vps.md).
//
// Sin logica de negocio, sin acceso a base de datos: solo sabe
// reenviar metodo+path+headers+body y devolver status+headers+body.
// Un bridge = una empresa. Todo en memoria (sin Redis/DB): si el
// proceso se reinicia, los requests en vuelo expiran y el celular
// reintenta (comportamiento ya esperado por la app offline-first).
// ============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT               = Number(process.env.PORT)               || 4000;
const AGENT_TOKEN         = process.env.AGENT_TOKEN                || '';
const POLL_HOLD_MS        = Number(process.env.POLL_HOLD_MS)       || 25000;
const HEARTBEAT_STALE_MS  = Number(process.env.HEARTBEAT_STALE_MS) || 35000;
const TASK_WAIT_MS        = Number(process.env.TASK_WAIT_MS)       || 60000;

if (!AGENT_TOKEN) {
  console.warn('AVISO: AGENT_TOKEN no esta seteado — el canal /agent/* queda sin autenticar. Configuralo en bridge/.env');
}

app.use(cors());

// ── Estado en memoria ─────────────────────────────────────
let lastSeenAt = 0;                 // ultimo /agent/poll recibido (heartbeat del agente)
const pending  = [];                 // tareas esperando que el agente las retire
const inflight = new Map();          // taskId -> { resolve }
let waiting    = null;               // { res, timer } — long-poll del agente actualmente abierto

function agenteConectado() {
  return Date.now() - lastSeenAt <= HEARTBEAT_STALE_MS;
}

function entregarTareaSiHayAgenteEsperando(task) {
  if (!waiting) return false;
  clearTimeout(waiting.timer);
  const { res } = waiting;
  waiting = null;
  res.status(200).json(task);
  return true;
}

function resolverTarea(taskId, resultado) {
  const entry = inflight.get(taskId);
  if (!entry) return false; // desconocida o ya resuelta (timeout, reinicio, etc.)
  inflight.delete(taskId);
  entry.resolve(resultado);
  return true;
}

// ── Autenticacion del canal agente↔bridge ─────────────────
function verificarTokenAgente(req, res, next) {
  const recibido = req.headers['x-agent-token'] || '';
  const esperado = AGENT_TOKEN;
  const a = Buffer.from(String(recibido));
  const b = Buffer.from(String(esperado));
  const valido = esperado && a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valido) return res.status(401).json({ ok: false, error: 'token invalido' });
  next();
}

// ── Canal agente↔bridge (control plane, JSON propio) ──────
const agentRouter = express.Router();
agentRouter.use(express.json({ limit: '25mb' }));

// El agente pregunta si hay tareas pendientes. Long-poll: mantiene
// la conexion abierta hasta que haya una tarea o venza POLL_HOLD_MS.
agentRouter.post('/poll', verificarTokenAgente, (req, res) => {
  lastSeenAt = Date.now();

  if (pending.length > 0) {
    return res.status(200).json(pending.shift());
  }

  // Si ya habia otro poll esperando (reconexion del agente mientras el
  // anterior seguia abierto), lo cerramos limpio antes de tomar este.
  if (waiting) {
    clearTimeout(waiting.timer);
    waiting.res.status(204).end();
    waiting = null;
  }

  const timer = setTimeout(() => {
    waiting = null;
    res.status(204).end();
  }, POLL_HOLD_MS);

  waiting = { res, timer };

  // OJO: 'close' tiene que escucharse en `res`, no en `req`. El 'close'
  // de `req` puede disparar apenas termina de leerse el body (antes de
  // que la respuesta se envie), lo que cancelaria el timer de inmediato
  // y dejaria el long-poll colgado para siempre. `res` 'close' si refleja
  // la desconexion real del cliente mientras la respuesta sigue abierta.
  res.on('close', () => {
    if (waiting && waiting.res === res) {
      clearTimeout(waiting.timer);
      waiting = null;
    }
  });
});

// El agente devuelve el resultado de una tarea que proceso.
agentRouter.post('/result', verificarTokenAgente, (req, res) => {
  const { taskId, status, headers, body } = req.body || {};
  if (!taskId) return res.status(400).json({ ok: false, error: 'falta taskId' });
  resolverTarea(taskId, { status: status || 502, headers: headers || {}, body: body ?? '' });
  res.status(200).json({ ok: true });
});

app.use('/agent', agentRouter);

// ── Reenvio generico de /api/* ─────────────────────────────
// Body capturado como texto crudo (no se re-serializa) para no alterar
// el payload exacto que viaja hacia/desde el backend local.
app.use('/api', express.text({ type: () => true, limit: '25mb' }));

app.use('/api', (req, res) => {
  if (!agenteConectado()) {
    return res.status(503).json({ ok: false, error: 'agente desconectado' });
  }

  const taskId = crypto.randomUUID();
  const task = {
    taskId,
    method:  req.method,
    path:    req.originalUrl,
    headers: {
      'content-type': req.headers['content-type'] || 'application/json',
      accept:         req.headers['accept'] || 'application/json',
    },
    body: req.body || '',
  };

  const promesa = new Promise((resolve) => {
    inflight.set(taskId, { resolve });
    setTimeout(() => {
      if (inflight.delete(taskId)) {
        resolve({ status: 504, headers: {}, body: JSON.stringify({ ok: false, error: 'timeout esperando al agente' }) });
      }
    }, TASK_WAIT_MS);
  });

  if (!entregarTareaSiHayAgenteEsperando(task)) {
    pending.push(task);
  }

  promesa.then((resultado) => {
    const headers = resultado.headers || {};
    for (const [k, v] of Object.entries(headers)) res.set(k, v);
    res.status(resultado.status || 502).send(resultado.body ?? '');
  });
});

// ── Frontend estatico (build de produccion, front/dist) ────
// En produccion normalmente Nginx sirve esto directo; se deja aca
// tambien para poder probar el bridge standalone sin Nginx.
const frontDist = path.join(__dirname, '..', 'front', 'dist');
app.use(express.static(frontDist));
app.get(/^(?!\/api)(?!\/agent).*/, (req, res) => {
  res.sendFile(path.join(frontDist, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Bridge → http://0.0.0.0:${PORT}  (poll=${POLL_HOLD_MS}ms stale=${HEARTBEAT_STALE_MS}ms taskWait=${TASK_WAIT_MS}ms)`);
});
