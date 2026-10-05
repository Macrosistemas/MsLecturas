@echo off
REM Detiene el servicio MsLecturasAgent
setlocal
set SCRIPT_DIR=%~dp0

net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo ERROR: este script tiene que correr como Administrador.
    pause
    exit /b 1
)

"%SCRIPT_DIR%nssm.exe" stop MsLecturasAgent
echo.
sc query MsLecturasAgent
pause
endlocal
