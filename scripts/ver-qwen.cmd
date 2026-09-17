@echo off
chcp 65001 >nul
title Qwen en vivo - Tobi Deep Improvement
cd /d "%~dp0"
node watch_qwen.mjs %*
echo.
echo (Monitor finalizado. Presione una tecla para cerrar.)
pause >nul
