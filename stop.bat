@echo off
chcp 65001 >nul
echo ========================================
echo  Остановка локальной копии CRM
echo ========================================
echo.

cd /d "%~dp0"

echo Остановка контейнеров...
docker-compose down

echo.
echo [OK] Контейнеры остановлены
echo.
pause
