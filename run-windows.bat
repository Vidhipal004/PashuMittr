@echo off
set ROOT=%~dp0
start "PashuMittr API" cmd /k "cd /d %ROOT%backend && node server.js"
timeout /t 1 >nul
start "PashuMittr Frontend" cmd /k "cd /d %ROOT%frontend && npm run dev -- --host 0.0.0.0"
