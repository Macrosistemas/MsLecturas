@echo off
REM Desinstala el servicio MsLecturasAgent (no borra el proyecto ni el .env)
setlocal
set SCRIPT_DIR=%~dp0

net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: este script tiene que correr como Administrador.
    pause
    exit /b 1
)

"%SCRIPT_DIR%nssm.exe" stop MsLecturasAgent
"%SCRIPT_DIR%nssm.exe" remove MsLecturasAgent confirm

echo.
echo Servicio eliminado. El codigo y el .env quedan intactos.
pause
endlocal
