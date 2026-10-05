@echo off
REM Inicia el servicio MsLecturas (si estaba detenido)
setlocal
set SCRIPT_DIR=%~dp0

net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: este script tiene que correr como Administrador.
    pause
    exit /b 1
)

"%SCRIPT_DIR%nssm.exe" start MsLecturas
echo.
sc query MsLecturas
pause
endlocal
