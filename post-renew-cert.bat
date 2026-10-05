@echo off
REM ============================================================
REM MsLecturas -- hook de post-renovacion de certificado SSL
REM Lo ejecuta win-acme automaticamente (plugin de instalacion
REM "Script") despues de cada renovacion de lecturafgas.macrosistemas.ar.
REM Copia el cert/key recien emitidos a .\certs y reinicia el
REM servicio de Windows -- server.js los lee una sola vez al
REM arrancar, no hay hot-reload.
REM ============================================================
setlocal
set SCRIPT_DIR=%~dp0

REM Carpeta donde win-acme deja los .pem (--pemfilespath configurado
REM al reconfigurar el Store de la renovacion, ver guia de renovacion SSL)
set PEM_DIR=C:\win-acme\pem
set CERT_NAME=lecturafgas

if not exist "%PEM_DIR%\%CERT_NAME%-key.pem" (
    echo ERROR: no se encontro "%PEM_DIR%\%CERT_NAME%-key.pem"
    exit /b 1
)
if not exist "%PEM_DIR%\%CERT_NAME%-chain.pem" (
    echo ERROR: no se encontro "%PEM_DIR%\%CERT_NAME%-chain.pem"
    exit /b 1
)

copy /Y "%PEM_DIR%\%CERT_NAME%-key.pem"   "%SCRIPT_DIR%certs\key.pem"
copy /Y "%PEM_DIR%\%CERT_NAME%-chain.pem" "%SCRIPT_DIR%certs\cert.pem"

"%SCRIPT_DIR%nssm.exe" stop MsLecturas
timeout /t 3 /nobreak >nul
"%SCRIPT_DIR%nssm.exe" start MsLecturas

endlocal
