@echo off
rem Double-click de trien khai sang repo public. Xem scripts/deploy-public.mjs.
chcp 65001 >nul
cd /d "%~dp0"
node scripts\deploy-public.mjs %*
echo.
pause
