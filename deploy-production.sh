#!/bin/bash

# Скрипт для развертывания CRM на production сервере
# Использование: ./deploy-production.sh

set -e

echo "🚀 Начало развертывания CRM системы..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Функция для вывода сообщений
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка, что скрипт запущен с правами root
if [ "$EUID" -ne 0 ]; then
    log_error "Пожалуйста, запустите скрипт с правами root (sudo)"
    exit 1
fi

# 1. Обновление системы
log_info "Обновление системы..."
apt-get update
apt-get upgrade -y

# 2. Установка необходимых пакетов
log_info "Установка необходимых пакетов..."
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    nano \
    htop \
    ufw

# 3. Установка Docker
if ! command -v docker &> /dev/null; then
    log_info "Установка Docker..."
    
    # Удаление старых версий
    apt-get remove -y docker docker-engine docker.io containerd runc || true
    
    # Добавление официального GPG ключа Docker
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Добавление репозитория Docker
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Установка Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Запуск Docker
    systemctl start docker
    systemctl enable docker
    
    log_info "Docker установлен успешно!"
else
    log_info "Docker уже установлен"
fi

# 4. Настройка файрвола (UFW)
log_info "Настройка файрвола..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log_info "Файрвол настроен"

# 5. Создание директории для приложения
APP_DIR="/opt/crm"
log_info "Создание директории приложения: $APP_DIR"
mkdir -p $APP_DIR
cd $APP_DIR

# 6. Клонирование репозитория (если еще не клонирован)
if [ ! -d ".git" ]; then
    log_warn "Репозиторий не найден. Необходимо загрузить код вручную или через git clone"
    log_info "Пример: git clone https://github.com/arhteh596/granovskicrm.git ."
else
    log_info "Обновление кода из репозитория..."
    git pull
fi

# 7. Создание .env файла
if [ ! -f ".env.production" ]; then
    log_warn "Файл .env.production не найден. Создание шаблона..."
    cat > .env.production << 'EOF'
# Database
POSTGRES_DB=crm_db
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=CHANGE_THIS_STRONG_PASSWORD

# JWT
JWT_SECRET=CHANGE_THIS_JWT_SECRET_KEY

# Application
NODE_ENV=production
EOF
    log_warn "⚠️  ВАЖНО: Отредактируйте файл .env.production и установите надежные пароли!"
    log_warn "    Команда: nano .env.production"
    exit 1
fi

# Копирование .env файла
cp .env.production .env

# 8. Создание необходимых директорий
log_info "Создание директорий..."
mkdir -p uploads/avatars uploads/csv
mkdir -p telegram-sessions
mkdir -p backend/logs
mkdir -p backups

# 9. Установка прав доступа
log_info "Настройка прав доступа..."
chown -R root:root $APP_DIR
chmod -R 755 $APP_DIR
chmod 600 .env

# 10. Остановка и удаление старых контейнеров
log_info "Остановка старых контейнеров..."
docker compose -f docker-compose.production.yml down || true

# 11. Сборка и запуск контейнеров
log_info "Сборка Docker образов..."
docker compose -f docker-compose.production.yml build --no-cache

log_info "Запуск контейнеров..."
docker compose -f docker-compose.production.yml up -d

# 12. Ожидание запуска базы данных
log_info "Ожидание запуска базы данных..."
sleep 10

# 13. Проверка статуса контейнеров
log_info "Проверка статуса контейнеров..."
docker compose -f docker-compose.production.yml ps

# 14. Показать логи
log_info "Последние логи:"
docker compose -f docker-compose.production.yml logs --tail=50

echo ""
echo -e "${GREEN}✅ Развертывание завершено!${NC}"
echo ""
echo "📋 Полезные команды:"
echo "  - Просмотр логов:      docker compose -f docker-compose.production.yml logs -f"
echo "  - Перезапуск:          docker compose -f docker-compose.production.yml restart"
echo "  - Остановка:           docker compose -f docker-compose.production.yml down"
echo "  - Статус контейнеров:  docker compose -f docker-compose.production.yml ps"
echo ""
echo "🌐 Ваш сайт будет доступен по адресу: https://granovski-crm.site"
echo ""
echo "⚠️  Убедитесь, что DNS записи настроены и указывают на IP сервера!"
