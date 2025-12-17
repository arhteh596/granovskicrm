# Multi-stage build для Frontend
FROM node:18-alpine as builder

WORKDIR /app

# Build args для API URL и VAPID ключа
ARG VITE_API_URL=http://localhost:5001/api
ARG VITE_VAPID_PUBLIC_KEY=""
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm ci

# Копируем исходный код
COPY . .

# Собираем приложение
RUN npm run build

# Production image с Nginx
FROM nginx:alpine

# Устанавливаем curl для healthcheck
RUN apk add --no-cache curl

# Копируем конфигурацию Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Копируем собранное приложение из builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Открываем порт
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -sf http://localhost:3000/ > /dev/null || exit 1

# Запускаем Nginx
CMD ["nginx", "-g", "daemon off;"]
