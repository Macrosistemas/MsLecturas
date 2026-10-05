// ============================================================
// MsLecturas — agent/agent.js
// Corre junto al server.js local (bindeado a 127.0.0.1, sin
// certs). No conoce la logica de negocio: hace long-polling
// saliente al bridge del VPS pidiendo tareas, las reproduce con
// un fetch por loopback contra el backend local, y devuelve el
// resultado al bridge. Ver docs/deployment-agente-vps.md.
// ============================================================
import 'dotenv/config';

const BRIDGE_URL        = (process.env.BRIDGE_URL || '').replace(/\/$/, '');
const AGENT_TOKEN        = process.env.AGENT_TOKEN || '';
const LOCAL_API_BASE     = (process.env.LOCAL_API_BASE || 'http://127.0.0.1:3001').replace(/\/$/, '');
const POLL_TIMEOUT_MS    = Number(process.env.AGENT_POLL_TIMEOUT_MS)  || 40000; // > POLL_HOLD_MS del bridge
const LOCAL_TIMEOUT_MS   = Number(process.env.AGENT_LOCAL_TIMEOUT_MS) || 55000; // < TASK_WAIT_MS del bridge
const RETRY_BACKOFF_MS   = Number(process.env.AGENT_RETRY_BACKOFF_MS) || 2000;

if (!BRIDGE_URL || !AGENT_TOKEN) {
  console.error('Falta BRIDGE_URL o AGENT_TOKEN en agent/.env — no puedo arrancar.');
  process.exit(1);
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedirTarea() {
  const res = await fetch(`${BRIDGE_URL}/agent/poll`, {
    method: 'POST',
    headers: { 'x-agent-token': AGENT_TOKEN, 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(POLL_TIMEOUT_MS),
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`poll respondio ${res.status}`);
  return res.json();
}

async function ejecutarEnLocal(task) {
  const url = `${LOCAL_API_BASE}${task.path}`;
  const sinBody = task.method === 'GET' || task.method === 'HEAD';
  try {
    const res = await fetch(url, {
      method: task.method,
      headers: { 'content-type': task.headers?.['content-type'] || 'application/json' },
      body: sinBody ? undefined : (task.body ?? ''),
      signal: AbortSignal.timeout(LOCAL_TIMEOUT_MS),
    });
    const body = await res.text();
    return {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
      body,
    };
  } catch (err) {
    console.error(`[agent] fallo reenviando ${task.method} ${task.path} a ${LOCAL_API_BASE}:`, err.message);
    return {
      status: 502,
      headers: {},
      body: JSON.stringify({ ok: false, error: `agent-local-fetch-failed: ${err.message}` }),
    };
  }
}

async function postearResultado(taskId, resultado) {
  try {
    await fetch(`${BRIDGE_URL}/agent/result`, {
      method: 'POST',
      headers: { 'x-agent-token': AGENT_TOKEN, 'content-type': 'application/json' },
      body: JSON.stringify({ taskId, ...resultado }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    console.error(`[agent] no pude postear resultado de ${taskId}:`, err.message);
  }
}

async function loop() {
  console.log(`[agent] arrancando — bridge=${BRIDGE_URL} local=${LOCAL_API_BASE}`);
  for (;;) {
    try {
      const task = await pedirTarea();
      if (!task) continue; // 204: nada pendiente, volver a pollear
      const resultado = await ejecutarEnLocal(task);
      await postearResultado(task.taskId, resultado);
    } catch (err) {
      console.error('[agent] error en el ciclo de poll:', err.message);
      await delay(RETRY_BACKOFF_MS);
    }
  }
}

loop();
