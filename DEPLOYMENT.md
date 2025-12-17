# Деплой CRM на VPS (Ubuntu 24.04)

## 1) DNS на GoDaddy

- A: `@` → `151.243.113.21`
- CNAME: `www` → `@`
  Подождите 5–30 минут до применения записей.

## 2) Копируем проект на сервер

С Windows (PowerShell):

```powershell
scp -r "C:\Users\user\Desktop\12121vv\12121" root@151.243.113.21:/srv/crm
```

## 3) Подключаемся по SSH

```bash
ssh root@151.243.113.21
# пароль: ******
```

## 4) Заполняем .env (при необходимости)

На сервере:

```bash
cd /srv/crm
cp -n .env.example .env || true
nano .env
```

Заполните `JWT_SECRET`, Telegram API, VAPID при необходимости.

## 5) Подготавливаем сервер и запускаем контейнеры

```bash
bash /srv/crm/tools/provision_server.sh \
  DOMAIN=Granovskiy-crm.online \
  PROJECT_DIR=/srv/crm \
  SWAP_SIZE_GB=4 \
  TIMEZONE=Etc/UTC
```

## 6) Проверка

```bash
docker logs -f crm-caddy
curl -I https://Granovskiy-crm.online/
curl -s https://Granovskiy-crm.online/api/health | jq
```

## Примечания

- Caddy автоматически выпустит сертификаты Let's Encrypt при доступности портов 80/443 и корректном DNS.
- UFW откроет только SSH/80/443; внутренние порты 3001/5001 недоступны извне.
- Все контейнеры запускаются с `restart: unless-stopped`.
