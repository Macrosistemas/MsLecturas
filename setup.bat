@echo off
REM ============================================================
REM MsLecturas — setup.bat
REM Crea la estructura completa del proyecto desde cero
REM Ejecutar desde la carpeta raíz del proyecto (MsLecturas\)
REM ============================================================

echo ======================================================
echo  MsLecturas — Setup inicial del proyecto
echo ======================================================

REM ── 1. Backend ───────────────────────────────────────────
echo.
echo [ 1/4 ] Instalando dependencias del backend...
call npm install
echo [OK] Backend listo

REM ── 2. Crear proyecto React con Vite ─────────────────────
echo.
echo [ 2/4 ] Creando proyecto React + Vite en .\front ...

IF EXIST "front\package.json" (
  echo   -^> Carpeta front\ ya existe, saltando creacion de Vite
) ELSE (
  call npm create vite@latest front -- --template react
  echo [OK] Proyecto Vite creado
)

REM ── 3. Instalar dependencias del frontend ─────────────────
echo.
echo [ 3/4 ] Instalando dependencias del frontend...
cd front

REM Copiar package.json definitivo antes de instalar
REM (el archivo ya está en la carpeta del proyecto)

call npm install
call npm install dexie crypto-js
call npm install -D vite-plugin-pwa workbox-window
echo [OK] Dependencias frontend instaladas

REM ── 4. Limpiar archivos default de Vite ──────────────────
echo.
echo [ 4/4 ] Limpiando archivos default de Vite...

IF EXIST "src\App.css"           del /f /q "src\App.css"
IF EXIST "src\index.css"         del /f /q "src\index.css"
IF EXIST "src\assets\react.svg"  del /f /q "src\assets\react.svg"
IF EXIST "public\vite.svg"       del /f /q "public\vite.svg"

echo [OK] Archivos default eliminados
cd ..

echo.
echo ======================================================
echo  [OK] Setup completado
echo ======================================================
echo.
echo  Proximos pasos:
echo.
echo  1. Configurar .env del backend:
echo     copy .env.example .env
echo     (editar con datos de SQL Server)
echo.
echo  2. Configurar .env del frontend:
echo     copy front\.env.example front\.env
echo     (editar VITE_API_URL con la IP del servidor)
echo.
echo  3. Generar certificados HTTPS:
echo     node generarCert.js 192.168.10.10
echo.
echo  4. Ejecutar la migration SQL en el servidor:
echo     migrations\sync_campos.sql
echo.
echo  5. Iniciar el backend (terminal 1):
echo     npm start
echo.
echo  6. Iniciar el frontend (terminal 2):
echo     cd front ^&^& npm run dev
echo.
echo  7. Abrir en el celular:
echo     https://192.168.10.10:5173
echo ======================================================
pause
