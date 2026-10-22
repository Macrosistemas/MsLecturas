@echo off
REM ============================================================
REM MsLecturas - deploy-front-vps.bat
REM Compila el front para Empresa 2 (Entegas) y lo publica en el VPS.
REM   1. npx vite build --mode empresa2  (usa front\.env.empresa2)
REM   2. empaqueta front\dist en un .tgz
REM   3. lo sube por scp y lo descomprime en front-dist (con backup previo)
REM   4. verifica que el sitio sirva el build nuevo
REM Uso: doble clic, o "deploy-front-vps.bat" desde la raiz del repo.
REM ============================================================
setlocal

set VPS_HOST=179.43.121.25
set VPS_PORT=5373
set VPS_USER=root
REM Carpeta que sirve Nginx (directiva "root" del server block de entegas)
set VPS_FRONT=/var/www/entegas.macrosistemas.ar
set SITE_URL=https://entegas.macrosistemas.ar
set TGZ=mslecturas-front-dist.tgz

echo.
echo === 1/4 Build del front (modo empresa2) ===
pushd "%~dp0front"
call npx vite build --mode empresa2
if errorlevel 1 (
  echo ERROR: fallo el build.
  popd
  if not defined NO_PAUSE pause
  exit /b 1
)

echo.
echo === 2/4 Empaquetando dist ===
REM tar de Windows explicito: el de Git (si esta primero en el PATH) toma "C:" como host remoto
"%SystemRoot%\System32\tar.exe" -czf "%TEMP%\%TGZ%" -C dist .
if errorlevel 1 (
  echo ERROR: no se pudo generar el .tgz.
  popd
  if not defined NO_PAUSE pause
  exit /b 1
)
popd

echo.
echo === 3/4 Subiendo al VPS (%VPS_USER%@%VPS_HOST%:%VPS_PORT%) ===
pushd "%TEMP%"
scp -P %VPS_PORT% %TGZ% %VPS_USER%@%VPS_HOST%:/tmp/%TGZ%
if errorlevel 1 (
  echo ERROR: fallo el scp.
  popd
  if not defined NO_PAUSE pause
  exit /b 1
)
popd

REM Backup de la version actual (se conservan los ultimos 3), reemplazo y limpieza
ssh -p %VPS_PORT% %VPS_USER%@%VPS_HOST% "set -e; F=%VPS_FRONT%; test -d $F || { echo No existe $F; exit 1; }; cp -a $F $F.bak-$(date +%%Y%%m%%d%%H%%M%%S); rm -rf $F/*; tar -xzf /tmp/%TGZ% -C $F; chown -R www-data:www-data $F; find $F -type d -exec chmod 755 {} +; find $F -type f -exec chmod 644 {} +;rm -f /tmp/%TGZ%; ls -dt $F.bak-* | tail -n +4 | xargs -r rm -rf; echo Archivos publicados en $F:; ls $F"
if errorlevel 1 (
  echo ERROR: fallo la publicacion en el VPS.
  if not defined NO_PAUSE pause
  exit /b 1
)
del "%TEMP%\%TGZ%" 2>nul

echo.
echo === 4/4 Verificando %SITE_URL% ===
curl -s %SITE_URL%/sw.js | findstr /c:"clientsClaim" >nul
if errorlevel 1 (
  echo ATENCION: el sw.js publicado no tiene clientsClaim - revisar.
) else (
  echo OK: sw.js publicado con autoUpdate.
)
for %%F in ("%~dp0front\dist\assets\index-*.js") do (
  curl -s %SITE_URL%/ | findstr /c:"%%~nxF" >nul && echo OK: el sitio sirve %%~nxF || echo ATENCION: el sitio no sirve %%~nxF - puede ser cache de Nginx/CDN.
)

echo.
echo Deploy terminado.
if not defined NO_PAUSE pause
endlocal
