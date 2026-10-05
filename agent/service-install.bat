@echo off
REM ============================================================
REM MsLecturas Agent -- instala el agente como servicio de Windows
REM Requiere: nssm.exe en esta misma carpeta + Node.js en el PATH
REM Corre junto al servicio MsLecturas (server.js), no lo reemplaza.
REM Ejecutar como Administrador
REM ============================================================
setlocal
set SERVICE_NAME=MsLecturasAgent
set SCRIPT_DIR=%~dp0
set NSSM=%SCRIPT_DIR%nssm.exe

net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: este script tiene que correr como Administrador.
    echo Click derecho -^> "Ejecutar como administrador"
    pause
    exit /b 1
)

if not exist "%NSSM%" (
    echo ERROR: no se encontro nssm.exe en %SCRIPT_DIR%
    echo Copia nssm.exe ^(64 bits^) en esta carpeta -- puede ser la misma copia que usa el backend en la carpeta raiz.
    pause
    exit /b 1
)

for /f "delims=" %%N in ('where node 2^>nul') do set NODE_EXE=%%N
if "%NODE_EXE%"=="" (
    echo ERROR: no se encontro node.exe en el PATH. Instala Node.js primero.
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

echo Instalando servicio "%SERVICE_NAME%"...
"%NSSM%" install %SERVICE_NAME% "%NODE_EXE%" "agent.js"
"%NSSM%" set %SERVICE_NAME% AppDirectory "%SCRIPT_DIR%"
"%NSSM%" set %SERVICE_NAME% AppStdout "%SCRIPT_DIR%logs\service-out.log"
"%NSSM%" set %SERVICE_NAME% AppStderr "%SCRIPT_DIR%logs\service-err.log"
"%NSSM%" set %SERVICE_NAME% AppRotateFiles 1
"%NSSM%" set %SERVICE_NAME% AppRotateBytes 1048576
"%NSSM%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM%" set %SERVICE_NAME% AppRestartDelay 5000
"%NSSM%" set %SERVICE_NAME% DisplayName "MsLecturas Agent"
"%NSSM%" set %SERVICE_NAME% Description "Agente outbound (long-polling) que conecta el server.js local con el bridge del VPS, sin exponer puertos entrantes."

echo.
echo Iniciando servicio...
"%NSSM%" start %SERVICE_NAME%

echo.
echo Listo. El servicio arranca solo con Windows a partir de ahora.
echo Usa service-status.bat para chequear el estado.
pause
endlocal
