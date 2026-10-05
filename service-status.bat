@echo off
REM Muestra el estado del servicio MsLecturas y las ultimas lineas de log
setlocal
set SCRIPT_DIR=%~dp0

echo === Estado del servicio ===
sc query MsLecturas

echo.
echo === Puertos (deberian aparecer 3001 y 3443 LISTENING) ===
netstat -ano | findstr ":3001 :3443"

echo.
echo === Ultimas lineas de log (stdout) ===
powershell -NoProfile -Command "if (Test-Path '%SCRIPT_DIR%logs\service-out.log') { Get-Content -Path '%SCRIPT_DIR%logs\service-out.log' -Tail 20 } else { 'Sin log todavia.' }"

echo.
echo === Ultimas lineas de log (stderr) ===
powershell -NoProfile -Command "if (Test-Path '%SCRIPT_DIR%logs\service-err.log') { Get-Content -Path '%SCRIPT_DIR%logs\service-err.log' -Tail 20 } else { 'Sin errores registrados.' }"

pause
endlocal
