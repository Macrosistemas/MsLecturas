# MsLecturas — Tomas de Estados de Consumo de Gas

Aplicación PWA offline-first para registro de lecturas de medidores de gas.

---

## Estructura del proyecto

```
MsLecturas\
  ├── server.js              ← API Express HTTP + HTTPS
  ├── package.json           ← dependencias backend
  ├── .env.example           ← copiar a .env y completar
  ├── generarCert.js         ← genera certs mkcert
  ├── certs\                 ← key.pem + cert.pem (generados)
  ├── routes\
  │   └── authSync.js        ← /api/auth/login, /api/sync/*
  ├── migrations\
  │   └── sync_campos.sql    ← ALTER TABLE se_lecturas
  └── front\
      ├── package.json       ← dependencias frontend
      ├── .env.example       ← copiar a .env con IP del servidor
      ├── vite.config.js
      ├── index.html
      └── src\
          ├── main.jsx
          ├── App.jsx
          ├── db.js              ← Dexie IndexedDB
          ├── authService.js     ← login online/offline
          ├── syncService.js     ← sync bidireccional
          ├── LoginForm.jsx
          ├── ConflictoModal.jsx
          └── TomasDeEstado.jsx  ← formulario principal
```

---

## Instalación paso a paso

### 1. Requisitos previos

- Node.js 20+
- SQL Server con las tablas `dba.se_lecturas`, `dba.se_calles`, `dba.usuarios`, `dba.se_medidores`, `dba.Clientes`
- `mkcert` instalado ([instrucciones](https://github.com/FiloSottile/mkcert#installation))

### 2. Base de datos — agregar campos de sync

Ejecutar **una sola vez** en SQL Server:

```sql
-- Archivo: migrations/sync_campos.sql
-- Ejecutar desde SQL Server Management Studio o sqlcmd
```

### 3. Backend

```bash
# Desde la raíz del proyecto
cp .env.example .env
# Editar .env con los datos de conexión SQL Server

npm install
```

### 4. Certificados HTTPS (necesario para PWA)

```bash
# Reemplazar con la IP real del servidor en la red local
node generarCert.js 192.168.1.100
```

Esto genera `./certs/key.pem` y `./certs/cert.pem`.

**En Android:** instalar `rootCA.crt` (la ruta se muestra al correr el script):
1. Copiar `rootCA.crt` al celular
2. Ajustes → Seguridad → Instalar desde almacenamiento → Credencial de CA

### 5. Iniciar servidor

```bash
npm start
# HTTP  → http://0.0.0.0:3001
# HTTPS → https://0.0.0.0:3443
```

### 6. Frontend

```bash
cd front
cp .env.example .env
# Editar .env: VITE_API_URL=https://192.168.1.100:3443/api

npm install
npm run dev        # desarrollo
npm run build      # producción → dist/
```

### 7. Acceso desde el celular

Abrir en el navegador del celular: `https://192.168.1.100:5173`

Para producción, servir la carpeta `front/dist/` desde el mismo Express:

```javascript
// Agregar al final de server.js (después de las rutas)
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, 'front/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'front/dist/index.html')));
```

---

## Flujo de uso

### Primera vez (online)
1. Abrir la app desde el celular conectado a la red local
2. Ingresar con usuario y contraseña
3. El sistema descarga automáticamente: usuarios y calles (lookups)
4. En el menú principal → **"+ Nueva toma de estado"**
5. Ingresar el código de ruta y la fecha de lectura
6. El sistema carga los medidores del servidor

### Trabajo offline
7. Desconectarse de la red si es necesario
8. Para cada medidor → botón **"Cargar"** → ingresar la lectura
9. La app valida: lectura ≥ lectura anterior, fecha ≥ fecha anterior
10. Los registros quedan con estado **"Pend. sync"** (⏳)

### Sincronización
11. Volver a conectar a la red del servidor
12. El indicador verde en la barra superior confirma la conexión
13. Presionar **"⟳ Sync"** en la barra superior
14. Los datos se suben al servidor
15. En caso de conflicto, aparece el modal de resolución

---

## Estados de los registros

| Estado | Color | Significado |
|--------|-------|-------------|
| Sin lectura | 🟡 Amarillo | Descargado del servidor, sin lectura cargada |
| Pend. sync  | 🔵 Azul     | Lectura cargada, pendiente de subir al servidor |
| Sincronizado| 🟢 Verde    | Subido y confirmado por el servidor |
| Conflicto   | 🔴 Rojo     | Versión del servidor más nueva — requiere resolución manual |

---

## Endpoints del servidor

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Autenticación de usuario |
| GET  | `/api/sync/status` | Verificar conexión |
| POST | `/api/sync/log` | Registrar evento de sync |
| GET  | `/api/lookups/calles` | Descargar tabla de calles |
| GET  | `/api/lecturas/ruta/:id` | Medidores de una ruta |
| POST | `/api/lecturas/sync/upload` | Subir lecturas al servidor |
| GET  | `/api/lecturas/sync/download` | Descargar novedades del servidor |
| GET  | `/api/status` | Health check |

---

## Permisos de usuario

| Campo | Valor | Permiso |
|-------|-------|---------|
| `permite_modif` | `'S'` | Puede cargar y editar lecturas |

---

## Reglas de negocio

- `lectura` ≥ `lectura_ant` (no puede haber consumo negativo)
- `fecha_lectura` ≥ `fecha_lectura_ant`
- `lectura` y `fecha_lectura` son obligatorios
- `consumo` = `lectura` − `lectura_ant` (calculado, solo visual)
- La fecha de lectura se define una sola vez por turno y se aplica a todos los registros de la ruta
- Los datos del celular siempre tienen prioridad en caso de conflicto (a elección del usuario)
