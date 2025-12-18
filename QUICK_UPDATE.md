# Быстрое обновление CRM на VPS (production)

Этот документ — «короткая шпаргалка» как выкатить обновление за 3–5 минут без лишних движений.

> ⚠️ Важно: не храните пароли/секреты в репозитории и не вставляйте их в инструкции. Все секреты должны быть только в `.env` на сервере.

---

## 0) Предусловия

- Код проекта находится на сервере в: `/opt/crm`
- Прод-оркестрация: `docker-compose.production.yml`
- Реверс-прокси: Caddy (конфиг `Caddyfile.production`)

---

## 1) Подключиться к серверу

```bash
ssh root@<IP_СЕРВЕРА>
```

---

## 2) Быстрая проверка текущего состояния (до обновления)

```bash
cd /opt/crm

docker compose -f docker-compose.production.yml ps
```

Проверка health API (должно вернуть `{"status":"ok"...}`):

```bash
docker compose -f docker-compose.production.yml exec -T backend wget -qO- http://localhost:3000/api/health
```

---

## 3) Сделать быстрый бэкап (рекомендуется)

### 3.1 Бэкап базы (SQL)

```bash
cd /opt/crm
mkdir -p backups

docker exec crm_postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "backups/db_$(date +%Y%m%d_%H%M%S).sql"
ls -lh backups | tail
```

> Если переменных окружения в текущей shell нет — возьмите значения из `/opt/crm/.env`.

### 3.2 (Опционально) Бэкап кода

```bash
cd /opt
cp -r crm "crm_backup_$(date +%Y%m%d_%H%M%S)"
```

---

## 4) Обновить код из Git

```bash
cd /opt/crm

git status
# если есть локальные правки — лучше сохранить
# git stash

git pull
```

---

## 5) Пересобрать и поднять контейнеры

### Вариант A (обычно достаточно)

```bash
cd /opt/crm

docker compose -f docker-compose.production.yml up -d --build
```

### Вариант B (если менялись зависимости / странные кеши)

```bash
cd /opt/crm

docker compose -f docker-compose.production.yml build --no-cache
docker compose -f docker-compose.production.yml up -d
```

> Примечание: в актуальной версии backend **сам запускает миграции БД при старте** (это фиксит ошибки 500 из‑за отсутствия таблиц/колонок).

---

## 6) Проверки после обновления

### 6.1 Статус контейнеров

```bash
docker compose -f docker-compose.production.yml ps
```

### 6.2 Логи backend (если есть 500/502)

```bash
docker compose -f docker-compose.production.yml logs --tail=200 backend
```

### 6.3 Проверка API

```bash
docker compose -f docker-compose.production.yml exec -T backend wget -qO- http://localhost:3000/api/health
```

### 6.4 Проверка сайта снаружи

```bash
curl -I https://<ВАШ_ДОМЕН>
```

---

## 7) Если после обновления загрузка CSV даёт 500

Два самых частых сценария:

### Сценарий A: Проблема со схемой БД (таблицы/колонки)

Смотрите логи backend:

```bash
docker compose -f docker-compose.production.yml logs --tail=200 backend
```

Типичные ошибки:
- `relation "databases" does not exist`
- `column ... does not exist`

Решение: обычно **достаточно перезапуска backend**, потому что миграции запускаются при старте:

```bash
docker compose -f docker-compose.production.yml restart backend
```

### Сценарий B: Нет прав на `uploads/` (Linux permissions)

Признак в логах:
- `EACCES: permission denied, mkdir '/app/uploads/csv'`

Решение (на хосте):

```bash
cd /opt/crm
mkdir -p uploads/csv uploads/avatars backend/logs telegram-sessions

# сделать папки доступными для контейнера (простой вариант)
chmod -R 777 uploads backend/logs telegram-sessions

docker compose -f docker-compose.production.yml restart backend
```

---

## 8) Быстрый откат (если что-то пошло не так)

### 8.1 Откат к предыдущему коммиту

```bash
cd /opt/crm

git log --oneline -n 10
# выберите нужный HASH
# git reset --hard <HASH>

docker compose -f docker-compose.production.yml up -d --build
```

### 8.2 Откат из бэкапа папки

```bash
cd /opt

# остановить текущие контейнеры
cd /opt/crm
docker compose -f docker-compose.production.yml down

# восстановить папку
cd /opt
rm -rf crm
mv crm_backup_YYYYMMDD_HHMMSS crm

# поднять
cd /opt/crm
docker compose -f docker-compose.production.yml up -d --build
```

### 8.3 Восстановление БД из SQL-бэкапа

```bash
cd /opt/crm

# ВАЖНО: убедитесь, что выбрали правильный файл
ls -lh backups | tail

# восстановление
cat backups/db_YYYYMMDD_HHMMSS.sql | docker exec -i crm_postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"
```

---

## 9) Полезные команды

```bash
# все логи
cd /opt/crm

docker compose -f docker-compose.production.yml logs -f

# перезапуск только backend

docker compose -f docker-compose.production.yml restart backend

# состояние диска

df -h

# ресурсы контейнеров

docker stats
```
