@echo off
chcp 65001 >nul
echo ========================================
echo  Проверка кодировки базы данных
echo ========================================
echo.

cd /d "%~dp0"

echo Подключение к базе данных...
echo.

docker exec -it crm-postgres-local psql -U crm_user -d crm_db -c "\l"
echo.
echo Кодировка клиента:
docker exec -it crm-postgres-local psql -U crm_user -d crm_db -c "\encoding"
echo.
echo Параметры локали:
docker exec -it crm-postgres-local psql -U crm_user -d crm_db -c "SHOW lc_collate;"
docker exec -it crm-postgres-local psql -U crm_user -d crm_db -c "SHOW lc_ctype;"
docker exec -it crm-postgres-local psql -U crm_user -d crm_db -c "SHOW client_encoding;"
echo.
echo Проверка кириллицы в данных:
docker exec -it crm-postgres-local psql -U crm_user -d crm_db -c "SELECT id, username, full_name FROM users WHERE full_name ~ '[А-Яа-я]' LIMIT 5;"
echo.
pause
