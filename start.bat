@echo off
chcp 65001 >nul
echo ========================================
echo  Запуск локальной копии CRM системы
echo ========================================
echo.

cd /d "%~dp0"

echo Проверка Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ОШИБКА] Docker не установлен или не запущен!
    pause
    exit /b 1
)

echo [OK] Docker доступен
echo.

echo Запуск контейнеров...
docker-compose up -d

if errorlevel 1 (
    echo.
    echo [ОШИБКА] Не удалось запустить контейнеры!
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Проект запущен успешно!
echo ========================================
echo.
echo Сервисы доступны по адресам:
echo   Frontend:  http://localhost:3001
echo   Backend:   http://localhost:5001
echo   Database:  localhost:5433
echo.
echo Для просмотра логов: docker-compose logs -f
echo Для остановки: docker-compose down
echo.
pause
