# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto

MsLecturas es una PWA **offline-first** para que operadores de campo registren lecturas de medidores de gas desde el celular. El celular no necesita internet: se conecta por **WiFi a la misma LAN** donde corre el backend, descarga la ruta de medidores asignada, y el operador sale a la calle a tomar lecturas sin conexión. Al volver a estar en la red, sincroniza lo cargado contra SQL Server.

Monorepo con dos proyectos independientes (cada uno con su propio `package.json`/`node_modules`):
- **Raíz** (`/`): backend Express (Node, ESM) que expone la API y sirve HTTP+HTTPS en simultáneo.
- **`front/`**: SPA React 19 + Vite, PWA con Dexie (IndexedDB) como base local.

## Comandos

Backend (desde la raíz):
```bash
npm install
npm start          # node server.js — HTTP :3001 + HTTPS :3443
npm run dev         # node --watch server.js (autoreload)
npm run cert        # node generarCert.js <IP_LAN>  — genera certs mkcert en ./certs
```

Frontend (desde `front/`):
```bash
npm install
npm run dev         # vite (sirve en 0.0.0.0:5173, HTTPS si hay certs en ../certs)
npm run build        # → front/dist
npm run preview
```

No hay suite de tests ni linter configurado en ninguno de los dos proyectos.

Setup completo desde cero: `setup.bat` (raíz) automatiza instalación de backend, scaffold de Vite en `front/` e instalación de dependencias del frontend.

## Arquitectura

### Backend (raíz)

- `server.js`: crea la app Express, arranca **dos servidores simultáneos** (`http.createServer` en `PORT`, `https.createServer` en `HTTPS_PORT` usando `./certs/key.pem` + `cert.pem` si existen), y mantiene un **pool de conexión mssql singleton** vía `getPool()` (exportado y reusado por las rutas). Define endpoints de lookups (`/api/lookups/calles`), carga de ruta (`/api/lecturas/ruta/:codigoRuta`) y sync de lecturas (`/api/lecturas/sync/upload`, `/api/lecturas/sync/download`).
- `routes/authSync.js`: login (`/api/auth/login`, valida contra `dbo.usuarios` con clave en texto plano) y utilidades de sync (`/api/sync/status`, `/api/sync/log`).
- Tablas SQL Server relevantes: `dbo.se_medidores`, `dbo.se_lecturas`, `dbo.se_calles`, `dbo.Clientes`, `dbo.usuarios`, `dbo.sync_log_app`.
- `migrations/sync_campos.sql`: agrega a `se_lecturas` las columnas de sincronización (`sync_estado`, `sync_origen`, `sync_fecha`, `sync_version`, `local_id`) — ejecutar una sola vez en el servidor SQL antes de usar el sync.
- `generarCert.js`: wrapper de `mkcert` para generar certificado HTTPS válido para una IP LAN + `localhost`. Requiere `mkcert` instalado en el SO. Solo se usa para desarrollo/test local — producción usa win-acme (ver más abajo).
- `post-renew-cert.bat`: hook que ejecuta win-acme (plugin de instalación "Script") tras cada renovación del certificado de producción — copia los `.pem` recién emitidos a `./certs/key.pem` y `cert.pem` y reinicia el servicio Windows `MsLecturas` (NSSM) para que `server.js` los relea, ya que los certs solo se leen una vez al arrancar (sin hot-reload).

### Frontend (`front/src/`)

- `db.js`: esquema Dexie (`MsLecturasDB`) y **todos los helpers de acceso a datos locales**. Tablas: `sesion` (única fila, clave `'actual'`), `usuarios` (caché de credenciales para login offline), `lookups` (combos, clave compuesta `[tipo+codigo]`), `se_lecturas` (tabla principal, PK `local_id` generado en el cliente), `sync_queue`, `sync_log`. Toda lógica de negocio local (validar pendientes antes de recargar una ruta, contadores por estado, cola de sync) vive acá, no en los componentes.
- `authService.js`: `login()` decide online/offline según `puedeAlcanzarServidor()`. Login online guarda el usuario localmente con `clave_hash` (SHA-256 + salt estático) para permitir login offline después. Login offline compara contra ese hash local.
- `syncService.js`: `sincronizar()` es el único punto de subida de datos — sube todo lo que esté en `sync_estado='U'`, resuelve la respuesta del servidor actualizando estado a `'S'` (sincronizado) o `'C'` (conflicto). `cargarRutaDesdeServidor()` es la descarga inicial de una ruta.
- `App.jsx`: shell de la app — barra superior sticky con estado de conexión (polling cada 5s), contadores (polling cada 8s), botón de sync manual, logout con confirmación si hay pendientes. Decide qué pantalla mostrar (`LoginForm` vs `TomasDeEstado`) según si hay sesión en Dexie.
- `TomasDeEstado.jsx`: formulario/listado principal donde el operador carga rutas y lecturas.
- `ConflictoModal.jsx`: UI de resolución manual de conflictos (side-by-side "mi versión" vs "versión servidor").
- Estilos: cada componente inyecta su propio `<style>` vía `injectCSS()` (sin CSS Modules ni archivos `.css`) — no hay sistema de estilos separado, es intencional en este proyecto.
- PWA: configurada en `vite.config.js` con `vite-plugin-pwa` (`registerType: 'prompt'`, manifest standalone/portrait). El dev server usa HTTPS si detecta certs en `../certs`.

### Modelo de sincronización (lo más importante para tocar código de sync)

`sync_estado` en `se_lecturas` es una máquina de estados:
- `P` = pendiente de que el operador cargue la lectura (recién descargado del servidor)
- `U` = lectura cargada localmente, pendiente de subir
- `S` = sincronizado con el servidor
- `C` = conflicto (el servidor tenía `sync_version` mayor al momento de subir)
- `B` = marcado para borrar en servidor (definido en la migración, no usado aún en el código de sync actual)

`local_id` (generado en el cliente, formato `loc_<timestamp>_<random>`) es la clave de idempotencia: el backend lo usa en `upload` para decidir INSERT vs UPDATE, evitando duplicados si se reintenta el sync. La detección de conflicto compara `sync_version` (servidor vs. cliente); en empate o cliente más nuevo, gana el cliente.

Regla de guarda clave (`db.js` → `cargarLecturasRuta`): no se puede volver a descargar/recargar una ruta si tiene lecturas en estado `U` sin sincronizar — hay que sincronizar primero. Esto es lo que evita perder trabajo de campo al re-descargar.

## Reglas de negocio (de README.md)

- `lectura` ≥ `lectura_ant` (no puede haber consumo negativo) y `fecha_lectura` ≥ `fecha_lectura_ant`.
- `consumo` se calcula en el cliente (`lectura − lectura_ant`), es solo informativo.
- La fecha de lectura se define una única vez por turno/ruta y se aplica a todos los medidores de esa ruta al cargarla.
- En conflicto, el operador elige manualmente qué versión prevalece (no hay resolución automática).
- Permiso `usuarios.permite_modif = 'S'` habilita carga/edición de lecturas.

## Configuración de entorno

- Backend: `.env` en la raíz (`DB_USER`, `DB_PASSWORD`, `DB_SERVER`, `DB_NAME`, `PORT`, `HTTPS_PORT`).
- Frontend: `front/.env` (`VITE_API_URL`, ej. `https://192.168.x.x:3443/api`).
- HTTPS es necesario para que la PWA se pueda instalar en el celular: certificados generados con `mkcert` para la IP LAN del servidor, y el `rootCA.crt` de mkcert debe instalarse manualmente como CA de confianza en cada dispositivo Android (Ajustes → Seguridad → Instalar desde almacenamiento → Credencial de CA). Sin ese paso, el navegador no lo trata como origen seguro y no ofrece "Instalar app".
- **No hay `.gitignore` en el repo todavía** y aún no hay ningún commit. Antes del primer commit hay que excluir `node_modules/`, `.env` (raíz y `front/`), `front/dist/`, `front/dev-dist/` y `certs/` — actualmente `.env` contiene credenciales reales de SQL Server y quedaría versionado tal cual.
