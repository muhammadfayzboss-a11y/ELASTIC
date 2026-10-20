@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 yoki yangirog'ini o'rnating: https://nodejs.org/
  pause
  exit /b 1
)
echo ELASTIC ishga tushmoqda...
echo Brauzer: http://127.0.0.1:3000
echo Birinchi marta: quyida chiqqan maxsus setup havolasini oching.
echo To'xtatish: Ctrl+C
node server.mjs
pause
