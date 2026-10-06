# Deploy: patrón agente + bridge VPS (Empresa 2)

Notas de despliegue para la arquitectura nueva. Esto es documentación para la
fase de deploy real (VPS + servidor Windows de la Empresa 2); el plan de
implementación de código está en `feature/agente-vps`. La Empresa 1 no usa
nada de esto — sigue con HTTPS directo + mkcert como siempre.

> **Estado real:** el lado del VPS ya está desplegado y funcionando para
> `entegas.macrosistemas.ar` (bridge con pm2, Nginx + certbot, token ya
> generado). Lo que falta es instalar el agente en el servidor Windows de
> Entegas — ver sección 5. El resto de este documento queda como referencia
> general por si se agrega otra empresa más adelante.

## Resumen del flujo

```
celular ──HTTPS──> Nginx (VPS) ──> bridge/server.js (VPS, puerto interno)
                                       ▲  (long-poll saliente)
                                       │
                          agent/agent.js (oficina Empresa 2, Windows)
                                       │  (loopback HTTP)
                                       ▼
                          server.js (oficina Empresa 2, 127.0.0.1:3001)
                                       │
                                       ▼
                               SQL Server (empresa 2)
```

El `agent/agent.js` es el único que inicia conexiones hacia afuera — no hace
falta abrir ningún puerto entrante en la red de la oficina.

## 1. Variables de entorno

| Archivo | Variable | Valor |
|---|---|---|
| `.env` (raíz, Empresa 2) | `BIND_HOST` | `127.0.0.1` |
| `agent/.env` | `BRIDGE_URL` | `https://empresa2.tudominio.com` |
| `agent/.env` | `AGENT_TOKEN` | mismo secreto que `bridge/.env` |
| `agent/.env` | `LOCAL_API_BASE` | `http://127.0.0.1:3001` |
| `bridge/.env` | `AGENT_TOKEN` | mismo secreto que `agent/.env` |
| `bridge/.env` | `PORT` | `4000` (puerto interno, no expuesto directo) |
| `bridge/.env` | `POLL_HOLD_MS` / `HEARTBEAT_STALE_MS` / `TASK_WAIT_MS` | `25000` / `35000` / `60000` (default, ajustar si hace falta) |
| `front/.env.empresa2` | `VITE_API_URL` | `https://empresa2.tudominio.com/api` |

`AGENT_TOKEN` tiene que ser un string largo y aleatorio (ej: `openssl rand -hex 32`), idéntico en ambos `.env`.

## 2. Build del frontend para Empresa 2

Vite carga automáticamente `.env.<modo>` cuando se le pasa `--mode`:

```bash
cd front
npm install
npx vite build --mode empresa2   # usa front/.env.empresa2, genera front/dist
```

El `dist` resultante se sube al VPS (vía el mismo flujo de deploy que ya usan
para otros proyectos — tar + scp/ssh).

## 3. VPS: bridge con pm2

```bash
cd /opt/mslecturas-empresa2/bridge   # o la ruta que corresponda
npm install
cp .env.example .env   # completar AGENT_TOKEN, PORT
pm2 start server.js --name mslecturas-bridge-empresa2
pm2 save
pm2 startup   # una sola vez, para que sobreviva reinicios del VPS
```

## 4. VPS: Nginx + certbot

Un server block por subdominio/empresa. `/api/` y `/agent/` apuntan al mismo
puerto del bridge; los timeouts de Nginx tienen que ser mayores que
`TASK_WAIT_MS` y `POLL_HOLD_MS` respectivamente para no cortar el long-poll ni
una sync grande antes de tiempo.

```nginx
server {
    listen 80;
    server_name empresa2.tudominio.com;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name empresa2.tudominio.com;

    ssl_certificate     /etc/letsencrypt/live/empresa2.tudominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/empresa2.tudominio.com/privkey.pem;

    client_max_body_size 25m;   # igual al limite de express.json/text del bridge

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_read_timeout 65s;   # > TASK_WAIT_MS (60s)
        proxy_send_timeout 65s;
    }

    location /agent/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_read_timeout 30s;   # > POLL_HOLD_MS (25s)
        proxy_send_timeout 30s;
    }

    location / {
        root /var/www/mslecturas-empresa2/front-dist;
        try_files $uri /index.html;
    }
}
```

Certificado via `certbot --nginx -d empresa2.tudominio.com` — renovación
automática, sin tocar nada manualmente (a diferencia del flujo actual con
mkcert para la Empresa 1).

## 5. Oficina Empresa 2 (Windows): agente + backend local

Hay dos formas de instalarlo en el servidor Windows de la empresa, según si
esa máquina tiene Node.js instalado o no.

### 5a. Si la máquina tiene Node.js instalado

El backend local (`server.js`, raíz del repo) se instala exactamente igual
que para la Empresa 1, pero con `BIND_HOST=127.0.0.1` en su `.env` y sin
generar certificados (no hace falta `generarCert.js` acá).

El agente es un servicio Windows nuevo, aparte:

```bat
cd agent
npm install
copy .env.example .env     REM completar BRIDGE_URL y AGENT_TOKEN
copy ..\nssm.exe .         REM el agente necesita su propia copia de nssm.exe
service-install.bat        REM como Administrador
```

### 5b. Si la máquina NO tiene Node.js (ejecutables standalone)

`build-exe/` empaqueta `agent.js` y `server.js` como `.exe` con Node
embebido adentro (Single Executable Application) — no hace falta instalar
nada más en esa máquina. Se generan en la PC de desarrollo:

```bat
cd build-exe
npm install
npm run build
REM genera build-exe\dist\agent.exe y build-exe\dist\server.exe
```

Copiar a la máquina de la empresa:
- `build-exe\dist\server.exe` → raíz del proyecto, junto a un `.env` propio
  (datos de SQL Server de esa empresa + `BIND_HOST=127.0.0.1`) y `nssm.exe`.
  Instalar con `service-install-exe.bat` (en vez de `service-install.bat`).
- `build-exe\dist\agent.exe` → carpeta `agent/`, junto a un `.env` propio
  (`BRIDGE_URL` / `AGENT_TOKEN` / `LOCAL_API_BASE`) y su propia copia de
  `nssm.exe`. Instalar con `agent/service-install-exe.bat`.

Los `.exe` pesan ~80-90mb cada uno porque incluyen el runtime de Node
completo — es esperado, no es un build roto.

Si el código de `agent.js` o `server.js` cambia, hay que volver a correr
`npm run build` en `build-exe/` y recopiar los `.exe` actualizados; no se
actualizan solos.

### Ambas opciones

Quedan dos servicios de Windows corriendo en la misma máquina: `MsLecturas`
(el backend de siempre, ahora en loopback) y `MsLecturasAgent` (el nuevo
agente). Se administran independientemente con los `service-*.bat` de cada
carpeta (están son las mismas para ambas variantes — `start`/`stop`/`status`/
`uninstall` no dependen de si el proceso es `node algo.js` o un `.exe`).

## 6. Checklist de validación antes de dar por andando la Empresa 2

- [ ] Punto de conexión en la app se pone verde dentro de los primeros 5s.
- [ ] Login real contra el SQL Server de la Empresa 2.
- [ ] Descarga de una ruta completa.
- [ ] Sync de un lote grande de lecturas pendientes (vigilar tiempos reales
      contra `TASK_WAIT_MS`, ajustar si una empresa con muchos medidores lo
      necesita).
- [ ] Matar `MsLecturasAgent` y confirmar que el punto pasa a offline en
      ~35s, y vuelve a verde al reiniciar el servicio.
- [ ] Reiniciar el bridge (`pm2 restart mslecturas-bridge-empresa2`) con el
      agente corriendo y confirmar que se reconecta solo.
