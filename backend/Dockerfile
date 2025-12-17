# Multi-stage build для Backend
FROM node:18-alpine as builder

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install

# Копируем исходный код
COPY . .

# Компилируем TypeScript
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Устанавливаем Python и pip для работы с Telegram модулем
RUN apk add --no-cache python3 py3-pip

# Устанавливаем переменные окружения
ENV NODE_ENV=production

# Копируем package.json из builder
COPY package*.json ./
COPY requirements.txt ./

# Устанавливаем только production зависимости
RUN npm install --omit=dev

# Устанавливаем Python зависимости
RUN pip3 install -r requirements.txt --break-system-packages

# Копируем скомпилированный код из builder
COPY --from=builder /app/dist ./dist

# Копируем Python скрипты для Telegram модуля
COPY --from=builder /app/src/telegram/scripts ./dist/telegram/scripts

# Создаем папку для Telegram сессий и устанавливаем права
RUN mkdir -p ./telegram-sessions && chown node:node ./telegram-sessions

# Используем непривилегированного пользователя
USER node

# Открываем порт
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5001/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Запускаем приложение
CMD ["node", "dist/server.js"]
