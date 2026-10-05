@echo off
REM Muestra el estado del servicio MsLecturasAgent y las ultimas lineas de log
setlocal
set SCRIPT_DIR=%~dp0

echo === Estado del servicio ===
sc query MsLecturasAgent

echo.
echo === Ultimas lineas de log (stdout) ===
powershell -NoProfile -Command "if (Test-Path '%SCRIPT_DIR%logs\service-out.log') { Get-Content -Path '%SCRIPT_DIR%logs\service-out.log' -Tail 20 } else { 'Sin log todavia.' }"

echo.
echo === Ultimas lineas de log (stderr) ===
powershell -NoProfile -Command "if (Test-Path '%SCRIPT_DIR%logs\service-err.log') { Get-Content -Path '%SCRIPT_DIR%logs\service-err.log' -Tail 20 } else { 'Sin errores registrados.' }"

pause
endlocal
