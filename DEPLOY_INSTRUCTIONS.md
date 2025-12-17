# 🚀 Инструкция по быстрому развертыванию обновлений CRM

## 📋 Данные сервера

- **IP:** 151.243.113.21
- **Пользователь:** root
- **Пароль:** NUN4BIU3zHxunAHTKfs2
- **Домен:** https://granovski-crm.site
- **GitHub:** https://github.com/arhteh596/granovskicrm.git

## 🔧 Быстрое развертывание обновлений

### 1. Подключение к серверу

```bash
ssh root@151.243.113.21
# Пароль: NUN4BIU3zHxunAHTKfs2
```

### 2. Обновление кода с GitHub

```bash
cd /opt/crm
git pull origin main
```

### 3. Перезапуск приложения

```bash
# Остановка контейнеров
docker compose -f docker-compose.production.yml down

# Пересборка и запуск
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d
```

### 4. Проверка статуса

```bash
# Проверка контейнеров
docker compose -f docker-compose.production.yml ps

# Проверка логов
docker compose -f docker-compose.production.yml logs -f

# Проверка сайта
curl -I https://granovski-crm.site
```

## 🛠 Пошаговая инструкция с проверками

### Шаг 1: Резервное копирование

```bash
# Создание бэкапа базы данных
docker exec crm_postgres pg_dump -U crm_user crm_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Создание копии текущего кода
cp -r /opt/crm /opt/crm_backup_$(date +%Y%m%d_%H%M%S)
```

### Шаг 2: Обновление кода

```bash
cd /opt/crm

# Проверка статуса Git
git status

# Сохранение локальных изменений (если есть)
git stash

# Получение обновлений
git fetch origin main
git pull origin main

# Восстановление локальных изменений (если нужно)
git stash pop
```

### Шаг 3: Проверка конфигурации

```bash
# Проверка .env файла
ls -la .env*

# Проверка паролей
grep -E "(POSTGRES_PASSWORD|JWT_SECRET)" .env
```

### Шаг 4: Обновление зависимостей (при необходимости)

```bash
# Если изменились package.json файлы
docker compose -f docker-compose.production.yml build --no-cache
```

### Шаг 5: Развертывание

```bash
# Остановка старых контейнеров
docker compose -f docker-compose.production.yml down

# Запуск новых контейнеров
docker compose -f docker-compose.production.yml up -d

# Ожидание запуска (30 секунд)
sleep 30
```

### Шаг 6: Проверка работоспособности

```bash
# Статус контейнеров
docker compose -f docker-compose.production.yml ps

# Проверка здоровья
docker compose -f docker-compose.production.yml exec backend wget -qO- http://localhost:3000/api/health

# Проверка сайта
curl -I https://granovski-crm.site
curl -I http://granovski-crm.site  # должен перенаправлять на HTTPS
```

## 🔍 Устранение типичных проблем

### Проблема: Backend unhealthy

```bash
# Проверка логов
docker logs crm_backend --tail=20

# Проверка подключения к БД
docker exec crm_postgres psql -U crm_user -d crm_db -c "SELECT 1;"

# Перезапуск backend
docker compose -f docker-compose.production.yml restart backend
```

### Проблема: 502 Bad Gateway

```bash
# Проверка логов Caddy
docker logs crm_caddy --tail=20

# Проверка конфигурации Caddy
cat Caddyfile.production

# Проверка портов
docker exec crm_frontend netstat -tlnp
docker exec crm_backend netstat -tlnp | grep 3000
```

### Проблема: База данных не найдена

```bash
# Проверка таблиц
docker exec crm_postgres psql -U crm_user -d crm_db -c "\dt"

# Восстановление из бэкапа
docker exec -i crm_postgres psql -U crm_user -d crm_db < database_dump_utf8.sql
```

### Проблема: SSL сертификат

```bash
# Перезапуск Caddy для обновления сертификатов
docker compose -f docker-compose.production.yml restart caddy

# Проверка логов SSL
docker logs crm_caddy | grep -i ssl
```

## 📁 Структура файлов на сервере

```
/opt/crm/
├── backend/                 # Backend код
├── frontend/               # Frontend код  
├── docker-compose.production.yml  # Production конфигурация
├── Caddyfile.production    # Caddy конфигурация
├── .env                    # Переменные окружения
├── .env.production         # Production настройки
├── database_dump_utf8.sql  # Бэкап базы данных
└── backups/                # Папка бэкапов (создается при нужде)
```

## 🗄 Восстановление базы данных

### Из стандартного дампа

```bash
cd /opt/crm
docker exec -i crm_postgres psql -U crm_user -d crm_db < database_dump_utf8.sql
```

### Из конкретного бэкапа

```bash
# Загрузка файла на сервер (с локальной машины)
scp C:\Users\user\Desktop\12121\backups\db_backup_20251216_203438.sql root@151.243.113.21:/opt/crm/

# На сервере
cd /opt/crm
docker exec -i crm_postgres psql -U crm_user -d crm_db < db_backup_20251216_203438.sql
```

### Создание нового бэкапа

```bash
# Создание бэкапа
docker exec crm_postgres pg_dump -U crm_user crm_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Проверка размера
ls -lh backup_*.sql
```

## 🚨 Экстренное восстановление

### Если что-то пошло не так

```bash
# Остановка всех контейнеров
docker compose -f docker-compose.production.yml down

# Восстановление из бэкапа кода
rm -rf /opt/crm
mv /opt/crm_backup_YYYYMMDD_HHMMSS /opt/crm
cd /opt/crm

# Запуск
docker compose -f docker-compose.production.yml up -d
```

### Полная переустановка

```bash
# Удаление всех контейнеров и данных
cd /opt/crm
docker compose -f docker-compose.production.yml down -v
docker system prune -af

# Заново клонирование проекта
cd /opt
rm -rf crm
git clone https://github.com/arhteh596/granovskicrm.git crm
cd crm

# Настройка переменных окружения
cp .env.production.example .env.production
nano .env.production  # Установить пароли

# Запуск
docker compose -f docker-compose.production.yml up -d

# Восстановление БД
docker exec -i crm_postgres psql -U crm_user -d crm_db < database_dump_utf8.sql
```

## 📊 Мониторинг

### Проверка ресурсов

```bash
# Использование диска
df -h

# Использование памяти
free -h

# Процессы
top

# Логи системы
tail -f /var/log/syslog
```

### Проверка контейнеров

```bash
# Статистика использования ресурсов
docker stats

# Размер контейнеров
docker system df

# Очистка неиспользуемых ресурсов
docker system prune -f
```

## 📞 Контакты и данные

### GitHub репозиторий
- **URL:** https://github.com/arhteh596/granovskicrm.git
- **Пользователь:** arhteh596
- **Email:** arhteh596@gmail.com

### Домен
- **Домен:** granovski-crm.site
- **Регистратор:** reg.ru

### VPS сервер
- **IP:** 151.243.113.21
- **Провайдер:** vxx_line
- **ОС:** Ubuntu 24.04
- **Ресурсы:** 4 vCPU, 12GB RAM, 180GB SSD

## 🔐 Пароли и секреты

**⚠️ Важно: Все пароли хранятся в файле .env.production на сервере**

```bash
# Просмотр паролей (только на сервере)
cat /opt/crm/.env.production | grep -E "(PASSWORD|SECRET)"
```

**Стандартные пароли из текущей установки:**
- **DB Password:** c4a3a76e6e20962f35d584e073f6c1a5
- **JWT Secret:** HbQ5PYPJrp9QBTqpDpJvXLveqwM22/N9kEYRpAp6QuU=

---

**📝 Примечание:** Эта инструкция создана 17 декабря 2025 г. При изменении конфигурации сервера обновите соответствующие разделы.