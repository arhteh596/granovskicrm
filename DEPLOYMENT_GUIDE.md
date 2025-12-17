# Инструкция по развертыванию CRM на production сервере

## Информация о сервере

- **Домен:** granovski-crm.site
- **IP:** 151.243.113.21
- **ОС:** Ubuntu 24.04
- **Конфигурация:** 4 vCPU, 12GB RAM, 180GB SSD

## Шаг 1: Настройка DNS на reg.ru

1. Зайдите на сайт reg.ru
2. Перейдите в управление доменом granovski-crm.site
3. Найдите раздел "DNS-серверы и DNS-записи"
4. Добавьте следующие записи:

**A-запись для домена:**
```
Тип: A
Имя: @ (или оставьте пустым)
Значение: 151.243.113.21
TTL: 3600
```

**A-запись для www:**
```
Тип: A
Имя: www
Значение: 151.243.113.21
TTL: 3600
```

5. Сохраните изменения
6. Подождите 15-30 минут для применения изменений DNS

## Шаг 2: Подключение к серверу

Откройте терминал (PowerShell) и подключитесь к серверу:

```powershell
ssh root@151.243.113.21
```

При первом подключении ответьте "yes" на вопрос о добавлении ключа.

Введите пароль: `NUN4BIU3zHxunAHTKfs2`

## Шаг 3: Загрузка кода на сервер

### Вариант 1: Через Git (рекомендуется)

Если код уже выгружен на GitHub:

```bash
cd /opt
git clone https://github.com/arhteh596/-.git crm
cd crm
```

### Вариант 2: Через SCP (если Git не завершился)

На вашем локальном компьютере (Windows):

```powershell
# Сжать проект в архив
Compress-Archive -Path "C:\Users\user\Desktop\12121\*" -DestinationPath "C:\Users\user\Desktop\crm.zip"

# Загрузить на сервер (используйте программу WinSCP или команду scp)
# Или используйте pscp из PuTTY:
pscp C:\Users\user\Desktop\crm.zip root@151.243.113.21:/opt/
```

На сервере:

```bash
cd /opt
unzip crm.zip -d crm
cd crm
```

## Шаг 4: Настройка переменных окружения

Отредактируйте файл .env.production:

```bash
nano .env.production
```

**Обязательно измените следующие значения:**

1. **POSTGRES_PASSWORD** - установите надежный пароль для базы данных
2. **DB_PASSWORD** - тот же пароль
3. **JWT_SECRET** - сгенерируйте случайную строку

Для генерации JWT_SECRET выполните:

```bash
openssl rand -base64 32
```

Пример настроенного .env.production:

```bash
POSTGRES_DB=crm_db
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=MyStr0ngP@ssw0rd123!
DB_USER=crm_user
DB_PASSWORD=MyStr0ngP@ssw0rd123!
DB_NAME=crm_db
JWT_SECRET=aB3dE5fG7hI9jK1lM3nO5pQ7rS9tU1vW3xY5zA==
```

Сохраните файл: `Ctrl+O`, затем `Enter`, потом `Ctrl+X`

## Шаг 5: Запуск скрипта развертывания

Сделайте скрипт исполняемым:

```bash
chmod +x deploy-production.sh
```

Запустите развертывание:

```bash
./deploy-production.sh
```

Скрипт выполнит:
- ✅ Обновление системы
- ✅ Установку Docker и Docker Compose
- ✅ Настройку файрвола
- ✅ Сборку Docker образов
- ✅ Запуск всех сервисов

## Шаг 6: Проверка работы

После завершения развертывания проверьте статус:

```bash
cd /opt/crm
docker compose -f docker-compose.production.yml ps
```

Все контейнеры должны быть в статусе "Up".

Просмотр логов:

```bash
# Все логи
docker compose -f docker-compose.production.yml logs -f

# Логи backend
docker compose -f docker-compose.production.yml logs -f backend

# Логи frontend
docker compose -f docker-compose.production.yml logs -f frontend
```

## Шаг 7: Доступ к CRM

Откройте браузер и перейдите по адресу:

```
https://granovski-crm.site
```

**Первый вход:**
- Логин: `admin`
- Пароль: `admin`

⚠️ **ВАЖНО:** Сразу после первого входа смените пароль администратора!

## Полезные команды

### Управление контейнерами

```bash
cd /opt/crm

# Просмотр статуса
docker compose -f docker-compose.production.yml ps

# Просмотр логов
docker compose -f docker-compose.production.yml logs -f

# Перезапуск всех сервисов
docker compose -f docker-compose.production.yml restart

# Перезапуск конкретного сервиса
docker compose -f docker-compose.production.yml restart backend

# Остановка всех сервисов
docker compose -f docker-compose.production.yml down

# Запуск всех сервисов
docker compose -f docker-compose.production.yml up -d

# Пересборка образов
docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d
```

### Обновление кода

```bash
cd /opt/crm

# Остановить контейнеры
docker compose -f docker-compose.production.yml down

# Обновить код
git pull

# Пересобрать и запустить
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
```

### Резервное копирование базы данных

```bash
# Создать backup
docker exec crm_postgres pg_dump -U crm_user crm_db > /opt/crm/backups/backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановить из backup
docker exec -i crm_postgres psql -U crm_user crm_db < /opt/crm/backups/backup_20231217_120000.sql
```

### Мониторинг системы

```bash
# Использование ресурсов Docker
docker stats

# Системные ресурсы
htop

# Дисковое пространство
df -h

# Логи системы
journalctl -xe
```

## Решение проблем

### Контейнер не запускается

```bash
# Проверить логи конкретного контейнера
docker compose -f docker-compose.production.yml logs backend

# Проверить статус
docker compose -f docker-compose.production.yml ps

# Пересобрать образ
docker compose -f docker-compose.production.yml build --no-cache backend
docker compose -f docker-compose.production.yml up -d
```

### База данных не доступна

```bash
# Проверить логи PostgreSQL
docker compose -f docker-compose.production.yml logs postgres

# Подключиться к базе данных напрямую
docker exec -it crm_postgres psql -U crm_user -d crm_db
```

### SSL сертификат не выдается

1. Проверьте DNS записи: `nslookup granovski-crm.site`
2. Проверьте логи Caddy: `docker compose -f docker-compose.production.yml logs caddy`
3. Убедитесь, что порты 80 и 443 открыты: `ufw status`

### Сайт не открывается

```bash
# Проверить статус всех контейнеров
docker compose -f docker-compose.production.yml ps

# Проверить файрвол
ufw status

# Проверить порты
netstat -tulpn | grep -E ':(80|443)'

# Проверить логи Caddy
docker compose -f docker-compose.production.yml logs caddy
```

## Безопасность

1. ✅ Файрвол настроен (только 22, 80, 443)
2. ✅ SSL сертификат выдается автоматически через Let's Encrypt
3. ⚠️ Смените пароль администратора при первом входе
4. ⚠️ Используйте сложные пароли в .env файле
5. ⚠️ Регулярно делайте backup базы данных

## Автоматизация backup

Создайте cron задачу для автоматического backup:

```bash
crontab -e
```

Добавьте строку (backup каждый день в 3:00):

```
0 3 * * * docker exec crm_postgres pg_dump -U crm_user crm_db > /opt/crm/backups/backup_$(date +\%Y\%m\%d_\%H\%M\%S).sql
```

## Контакты и поддержка

При возникновении проблем:
1. Проверьте логи: `docker compose -f docker-compose.production.yml logs -f`
2. Проверьте статус: `docker compose -f docker-compose.production.yml ps`
3. Перезапустите сервисы: `docker compose -f docker-compose.production.yml restart`

---

**Развертывание завершено! 🎉**

Ваша CRM система доступна по адресу: **https://granovski-crm.site**
