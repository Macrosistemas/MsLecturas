@echo off
REM ============================================================
REM MsLecturas -- instala el backend como servicio de Windows
REM usando server.exe (standalone, SIN necesitar Node.js instalado).
REM
REM Requiere en esta carpeta: nssm.exe, server.exe (build-exe/dist/server.exe)
REM y un archivo .env con los datos de conexion a SQL Server.
REM Pensado para el modo "agente" (BIND_HOST=127.0.0.1 en el .env) —
REM si esta maquina necesita servir la LAN directo por HTTPS, usa la
REM version con Node (service-install.bat) en vez de esta.
REM Ejecutar como Administrador
REM ============================================================
setlocal
set SERVICE_NAME=MsLecturas
set SCRIPT_DIR=%~dp0
set NSSM=%SCRIPT_DIR%nssm.exe
set SERVER_EXE=%SCRIPT_DIR%server.exe

net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: este script tiene que correr como Administrador.
    echo Click derecho -^> "Ejecutar como administrador"
    pause
    exit /b 1
)

if not exist "%NSSM%" (
    echo ERROR: no se encontro nssm.exe en %SCRIPT_DIR%
    echo Descargalo de https://nssm.cc/download y copia nssm.exe ^(64 bits^) en esta carpeta.
    pause
    exit /b 1
)

if not exist "%SERVER_EXE%" (
    echo ERROR: no se encontro server.exe en %SCRIPT_DIR%
    echo Copia ahi el archivo generado por build-exe/ ^(build-exe/dist/server.exe^).
    pause
    exit /b 1
)

if not exist "%SCRIPT_DIR%.env" (
    echo ERROR: falta %SCRIPT_DIR%.env
    echo Copia .env.example a .env y completa los datos de SQL Server ^(y BIND_HOST=127.0.0.1 para el modo agente^).
    pause
    exit /b 1
)

if not exist "%SCRIPT_DIR%logs" mkdir "%SCRIPT_DIR%logs"

sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% EQU 0 (
    echo El servicio "%SERVICE_NAME%" ya existe. Si queres reinstalarlo corre service-uninstall.bat primero.
    pause
    exit /b 1
)

echo Instalando servicio "%SERVICE_NAME%" ^(version .exe, sin Node.js^)...
"%NSSM%" install %SERVICE_NAME% "%SERVER_EXE%"
"%NSSM%" set %SERVICE_NAME% AppDirectory "%SCRIPT_DIR:~0,-1%"
"%NSSM%" set %SERVICE_NAME% AppStdout "%SCRIPT_DIR%logs\service-out.log"
"%NSSM%" set %SERVICE_NAME% AppStderr "%SCRIPT_DIR%logs\service-err.log"
"%NSSM%" set %SERVICE_NAME% AppRotateFiles 1
"%NSSM%" set %SERVICE_NAME% AppRotateBytes 1048576
"%NSSM%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM%" set %SERVICE_NAME% AppRestartDelay 5000
"%NSSM%" set %SERVICE_NAME% DisplayName "MsLecturas Backend"
"%NSSM%" set %SERVICE_NAME% Description "Backend Express de MsLecturas (API). Ejecutable standalone, no requiere Node.js instalado."

echo.
echo Iniciando servicio...
"%NSSM%" start %SERVICE_NAME%

echo.
echo Listo. El servicio arranca solo con Windows a partir de ahora.
echo Usa service-status.bat para chequear el estado.
pause
endlocal
