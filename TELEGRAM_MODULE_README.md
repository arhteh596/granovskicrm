# Telegram Module - Инструкция по установке и настройке

## Установка зависимостей

### Backend (Python)

Для работы Telegram модуля нужно установить библиотеку Telethon:

```bash
cd backend
pip install -r requirements.txt
```

Или установить напрямую:

```bash
pip install telethon
```

**Зависимости установлены автоматически!** ✅

### База данных

Миграция **уже применена** ✅

Если нужно применить вручную повторно:

```bash
cd backend
node apply-telegram-migration.js
```

## Конфигурация

### Telegram API Credentials

Основные credentials находятся в файле `backend/src/telegram/config/credentials.ts`:

```typescript
export const TELEGRAM_CONFIG = {
    primary: {
        apiId: 33104909,
        apiHash: '788e3ff651cd500926b4be32d07daa45'
    },
    fallback: {
        apiId: 0, // Заполните при наличии резервных credentials
        apiHash: ''
    }
};
```

### Директория для сессий

По умолчанию сессии хранятся в `./telegram-sessions`. Эта директория создается автоматически при первом запуске.

## Использование

### Для пользователей

1. **Роль "Закрыв"**: имеет доступ к страницам "Мамонты", "Катка" и может создавать Telegram сессии
2. **Роль "Админ"**: имеет полный доступ ко всем функциям

### Создание новой сессии

1. Откройте страницу "Мамонты" или "Катка"
2. Нажмите кнопку "Добавить сессию"
3. Введите номер телефона в международном формате (например, +79001234567)
4. Подтвердите код, отправленный в Telegram
5. Если включена 2FA - введите пароль

### API Endpoints

- `GET /api/telegram/check-connection` - проверка соединения с Telegram API
- `POST /api/telegram/send-code` - отправка кода авторизации
- `POST /api/telegram/verify-code` - верификация кода
- `POST /api/telegram/verify-password` - верификация пароля 2FA
- `GET /api/telegram/sessions` - список всех сессий
- `GET /api/telegram/sessions/:id` - информация о сессии
- `DELETE /api/telegram/sessions/:id` - удаление сессии
- `GET /api/telegram/sessions/:id/history` - история действий

## Структура модуля

```
backend/src/telegram/
├── config/
│   └── credentials.ts        # API credentials
├── controllers/
│   └── telegram.controller.ts # Обработчики запросов
├── routes/
│   └── telegram.routes.ts    # Маршруты API
├── scripts/
│   ├── check_connection.py   # Проверка соединения
│   ├── send_code.py          # Отправка кода
│   ├── verify_code.py        # Верификация кода
│   └── verify_password.py    # Верификация пароля
├── services/
│   ├── telegramAuth.service.ts    # Сервис авторизации
│   └── telegramSession.db.ts      # Работа с БД
└── types/
    └── telegram.types.ts     # TypeScript типы
```

## Безопасность

1. Храните API credentials в безопасном месте
2. Регулярно проверяйте активные сессии
3. Удаляйте неиспользуемые сессии
4. Используйте HTTPS для всех запросов

## Troubleshooting

### Ошибка "Failed to connect to Telegram"
- Проверьте правильность API credentials
- Убедитесь, что Python и Telethon установлены
- Проверьте интернет-соединение

### Сессия не сохраняется
- Проверьте права доступа к директории `telegram-sessions`
- Убедитесь, что миграция БД была применена корректно

### Ошибка при отправке кода
- Проверьте формат номера телефона (должен быть международный)
- Убедитесь, что номер зарегистрирован в Telegram
