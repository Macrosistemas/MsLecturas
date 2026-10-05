// ============================================================
// MsLecturas — server.js
// Express con HTTP:3001 + HTTPS:3443 simultáneos
// Las rutas de la API viven en ./routes — este archivo solo
// arma la app, el pool de SQL Server y levanta los servidores.
// ============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sql from 'mssql';

import authSyncRoutes from './routes/authSync.js';
import lookupsRoutes from './routes/lookups.js';
import lecturasRoutes from './routes/lecturas.js';
import statusRoutes from './routes/status.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ── Middlewares ───────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── Frontend estático (build de producción, front/dist) ───
const frontDist = path.join(__dirname, 'front', 'dist');
app.use(express.static(frontDist));

// ── Configuración SQL Server ──────────────────────────────
const dbConfig = {
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt:              false,
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let pool;
export async function getPool() {
  if (!pool) pool = await sql.connect(dbConfig);
  return pool;
}

// ── Rutas API ─────────────────────────────────────────────
app.use('/api', authSyncRoutes);
app.use('/api', lookupsRoutes);
app.use('/api', lecturasRoutes);
app.use('/api', statusRoutes);

// ── Fallback SPA — cualquier ruta no-API sirve index.html ─
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(frontDist, 'index.html'));
});

// ── Inicio de servidores ──────────────────────────────────
const PORT       = process.env.PORT       || 3001;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
// BIND_HOST: por defecto escucha en todas las interfaces (modo LAN de siempre).
// Para un servidor que solo va a ser alcanzado por el agente local (patrón
// agente+bridge VPS), se setea BIND_HOST=127.0.0.1 y no hace falta exponer
// puertos ni generar certificados en esa máquina.
const BIND_HOST  = process.env.BIND_HOST  || '0.0.0.0';

http.createServer(app).listen(PORT, BIND_HOST, () =>
  console.log(`HTTP  → http://${BIND_HOST}:${PORT}`)
);

const certKey  = './certs/key.pem';
const certFile = './certs/cert.pem';
if (fs.existsSync(certKey) && fs.existsSync(certFile)) {
  const tlsOptions = {
    key:  fs.readFileSync(certKey),
    cert: fs.readFileSync(certFile),
  };
  https.createServer(tlsOptions, app).listen(HTTPS_PORT, BIND_HOST, () =>
    console.log(`HTTPS → https://${BIND_HOST}:${HTTPS_PORT}`)
  );
} else {
  console.warn('Certs no encontrados — solo HTTP activo. Ejecutá generarCert.js');
}
