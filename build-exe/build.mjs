// Empaqueta agent/agent.js y server.js (raiz) como .exe standalone de Windows,
// usando esbuild (bundle en un solo archivo CJS) + Node Single Executable
// Applications (SEA). El resultado no necesita Node.js instalado en la
// maquina destino — el runtime de Node queda embebido en el .exe.
//
// Uso: desde build-exe/, `npm install` y despues `npm run build`.
// Salida: build-exe/dist/agent.exe y build-exe/dist/server.exe
import { build as esbuildBuild } from 'esbuild';
import { inject } from 'postject';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(__dirname, 'dist');
fs.mkdirSync(distDir, { recursive: true });

const SENTINEL = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';

const targets = [
  {
    name: 'agent',
    entry: path.join(root, 'agent', 'agent.js'),
    define: {},
  },
  {
    name: 'server',
    entry: path.join(root, 'server.js'),
    // import.meta.url se pierde al pasar a CJS (y vale undefined dentro de un
    // SEA, no vacio) — server.js lo usa solo para armar la ruta de front/dist,
    // que esta arquitectura (agente outbound) no sirve nunca desde aca. Un
    // file:// fijo evita el crash sin tocar el server.js compartido con la
    // Empresa 1.
    define: { 'import.meta.url': '"file:///C:/server.js"' },
  },
];

for (const t of targets) {
  console.log(`\n=== ${t.name} ===`);
  const bundlePath = path.join(distDir, `${t.name}.bundle.cjs`);
  const blobPath = path.join(distDir, `${t.name}.blob`);
  const seaConfigPath = path.join(distDir, `${t.name}.sea-config.json`);
  const exePath = path.join(distDir, `${t.name}.exe`);

  console.log('bundling...');
  const result = await esbuildBuild({
    entryPoints: [t.entry],
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    define: t.define,
    outfile: bundlePath,
    logLevel: 'warning',
  });
  if (result.warnings.length) {
    console.log(`  (${result.warnings.length} warning(s) — revisar si aparece algo nuevo fuera de 'import.meta')`);
  }

  console.log('generando blob SEA...');
  fs.writeFileSync(seaConfigPath, JSON.stringify({
    main: bundlePath,
    output: blobPath,
    disableExperimentalSEAWarning: true,
  }));
  execFileSync(process.execPath, ['--experimental-sea-config', seaConfigPath], { stdio: 'inherit' });

  console.log('copiando node.exe base...');
  fs.copyFileSync(process.execPath, exePath);
  fs.chmodSync(exePath, 0o755);

  console.log('inyectando blob (postject)...');
  await inject(exePath, 'NODE_SEA_BLOB', fs.readFileSync(blobPath), {
    sentinelFuse: SENTINEL,
    overwrite: true,
  });

  // Limpiar intermedios, solo nos interesa el .exe final
  fs.rmSync(bundlePath, { force: true });
  fs.rmSync(blobPath, { force: true });
  fs.rmSync(seaConfigPath, { force: true });

  console.log(`OK -> ${exePath}`);
}

console.log('\nListo. Los .exe quedan en build-exe/dist/. Siguen necesitando su .env al lado (igual que la version con Node) — ver docs/deployment-agente-vps.md.');
