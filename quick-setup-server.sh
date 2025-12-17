#!/bin/bash

# Быстрая настройка нового сервера
# Использование: bash quick-setup-server.sh

set -e

echo "🚀 Быстрая настройка сервера для CRM"
echo "======================================"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Проверка прав root
if [ "$EUID" -ne 0 ]; then
    log_error "Запустите скрипт с правами root"
    exit 1
fi

log_info "Шаг 1: Обновление системы"
apt update && apt upgrade -y

log_info "Шаг 2: Установка необходимых пакетов"
apt install -y curl git nano htop ufw

log_info "Шаг 3: Установка Docker"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    log_info "Docker уже установлен"
fi

log_info "Шаг 4: Настройка UFW"
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

log_info "Шаг 5: Клонирование проекта"
cd /opt
if [ -d "crm" ]; then
    log_warn "Директория /opt/crm уже существует. Удаляем..."
    rm -rf crm
fi

git clone https://github.com/arhteh596/granovskicrm.git crm
cd crm

log_info "Шаг 6: Создание конфигурационного файла"
if [ -f ".env.production.example" ]; then
    cp .env.production.example .env.production
else
    log_warn "Файл .env.production.example не найден. Создаем базовый .env.production"
    cat > .env.production << EOF
# Database
POSTGRES_DB=crm_db
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=crm_password_$(openssl rand -hex 8)
DB_HOST=postgres
DB_PORT=5432
DB_USER=crm_user
DB_PASSWORD=crm_password_$(openssl rand -hex 8)
DB_NAME=crm_db

# Application
NODE_ENV=production
PORT=3000
JWT_SECRET=$(openssl rand -base64 32)

# Domain
DOMAIN=granovski-crm.site
CERT_EMAIL=admin@granovski-crm.site
EOF
fi

log_info "Шаг 7: Настройка прав доступа"
chmod 600 .env.production
chown root:root .env.production

log_info "Готово! Следующие шаги:"
echo ""
echo -e "${YELLOW}1. Отредактируйте файл .env.production:${NC}"
echo "   nano .env.production"
echo ""
echo -e "${YELLOW}2. Запустите приложение:${NC}"
echo "   docker compose -f docker-compose.production.yml up -d"
echo ""
echo -e "${YELLOW}3. Проверьте статус:${NC}"
echo "   docker compose -f docker-compose.production.yml ps"
echo ""
echo -e "${GREEN}Сервер готов к работе!${NC}"