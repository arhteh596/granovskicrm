# Скрипт для автоматического развертывания CRM на сервере
# Запуск: .\quick-deploy.ps1

$ErrorActionPreference = "Stop"

# Параметры сервера
$SERVER_IP = "151.243.113.21"
$SERVER_USER = "root"
$SERVER_PASSWORD = "NUN4BIU3zHxunAHTKfs2"
$DOMAIN = "granovski-crm.site"
$GITHUB_REPO = "https://github.com/arhteh596/granovskicrm.git"

Write-Host "🚀 Автоматическое развертывание CRM на production сервере" -ForegroundColor Green
Write-Host ""
Write-Host "Сервер: $SERVER_IP" -ForegroundColor Cyan
Write-Host "Домен: $DOMAIN" -ForegroundColor Cyan
Write-Host ""

# Проверка наличия Git
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git не установлен!" -ForegroundColor Red
    Write-Host "Пожалуйста, завершите установку Git и перезапустите PowerShell" -ForegroundColor Yellow
    exit 1
}

# 1. Завершение выгрузки на GitHub (если еще не завершена)
Write-Host "📤 Шаг 1: Выгрузка кода на GitHub..." -ForegroundColor Yellow

try {
    git status | Out-Null
    
    # Проверяем, есть ли несохраненные изменения
    $status = git status --porcelain
    if ($status) {
        Write-Host "Обнаружены несохраненные изменения. Сохранение..." -ForegroundColor Yellow
        git add .
        git commit -m "Production deployment - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    }
    
    # Пытаемся запушить
    Write-Host "Выгрузка на GitHub..." -ForegroundColor Yellow
    git push -u origin main 2>&1 | Out-Null
    
    Write-Host "✅ Код выгружен на GitHub" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ошибка при работе с Git: $_" -ForegroundColor Yellow
    Write-Host "Продолжаем развертывание..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Шаг 2: Подготовка к развертыванию" -ForegroundColor Yellow
Write-Host ""

# 2. Информация для пользователя
Write-Host "ВАЖНО! Перед продолжением убедитесь, что:" -ForegroundColor Red
Write-Host "  1. ✅ DNS записи настроены на reg.ru:" -ForegroundColor White
Write-Host "     - A-запись: @ -> $SERVER_IP" -ForegroundColor Gray
Write-Host "     - A-запись: www -> $SERVER_IP" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. ✅ У вас есть доступ к серверу" -ForegroundColor White
Write-Host "     - IP: $SERVER_IP" -ForegroundColor Gray
Write-Host "     - User: $SERVER_USER" -ForegroundColor Gray
Write-Host ""

$confirm = Read-Host "Продолжить развертывание? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Развертывание отменено" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "📝 Шаг 3: Настройка переменных окружения" -ForegroundColor Yellow

# Генерация надежных паролей
Add-Type -AssemblyName System.Web
$dbPassword = [System.Web.Security.Membership]::GeneratePassword(24, 8)
$jwtSecret = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Web.Security.Membership]::GeneratePassword(32, 10)))

Write-Host ""
Write-Host "Сгенерированы пароли для production:" -ForegroundColor Green
Write-Host "  DB Password: $dbPassword" -ForegroundColor Cyan
Write-Host "  JWT Secret: $jwtSecret" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  СОХРАНИТЕ ЭТИ ПАРОЛИ В БЕЗОПАСНОМ МЕСТЕ!" -ForegroundColor Red
Write-Host ""

# Создание production .env файла
$envContent = @"
# ===== Production environment =====
# Database
POSTGRES_DB=crm_db
POSTGRES_USER=crm_user
POSTGRES_PASSWORD=$dbPassword
DB_USER=crm_user
DB_PASSWORD=$dbPassword
DB_NAME=crm_db
DB_SSL=false

# Auth
JWT_SECRET=$jwtSecret
JWT_EXPIRY=7d

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
VAPID_CONTACT_EMAIL=mailto:admin@$DOMAIN

# Frontend build
VITE_API_URL=https://$DOMAIN/api

# Domain
DOMAIN=$DOMAIN
"@

$envContent | Out-File -FilePath ".env.production.server" -Encoding UTF8
Write-Host "✅ Файл .env.production.server создан" -ForegroundColor Green

Write-Host ""
Write-Host "🔧 Шаг 4: Следующие действия для развертывания на сервере" -ForegroundColor Yellow
Write-Host ""

Write-Host "Выполните следующие команды для развертывания:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Подключитесь к серверу:" -ForegroundColor White
Write-Host "   ssh $SERVER_USER@$SERVER_IP" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Клонируйте репозиторий:" -ForegroundColor White
Write-Host "   cd /opt" -ForegroundColor Gray
Write-Host "   git clone $GITHUB_REPO crm" -ForegroundColor Gray
Write-Host "   cd crm" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Загрузите файл .env.production.server на сервер" -ForegroundColor White
Write-Host "   (используйте WinSCP или команду scp)" -ForegroundColor Gray
Write-Host ""
Write-Host "4. На сервере переименуйте файл:" -ForegroundColor White
Write-Host "   mv .env.production.server .env.production" -ForegroundColor Gray
Write-Host ""
Write-Host "5. Запустите развертывание:" -ForegroundColor White
Write-Host "   chmod +x deploy-production.sh" -ForegroundColor Gray
Write-Host "   ./deploy-production.sh" -ForegroundColor Gray
Write-Host ""

Write-Host "📄 Полная инструкция находится в файле DEPLOYMENT_GUIDE.md" -ForegroundColor Green
Write-Host ""

# Пауза для сохранения паролей
Read-Host "Нажмите Enter после сохранения паролей..."

Write-Host ""
Write-Host "✨ Подготовка завершена!" -ForegroundColor Green
Write-Host ""
Write-Host "Следующие шаги:" -ForegroundColor Cyan
Write-Host "1. Настройте DNS на reg.ru (если еще не настроено)" -ForegroundColor White
Write-Host "2. Подключитесь к серверу по SSH" -ForegroundColor White
Write-Host "3. Следуйте инструкциям в DEPLOYMENT_GUIDE.md" -ForegroundColor White
Write-Host ""
Write-Host "После развертывания CRM будет доступна по адресу:" -ForegroundColor Cyan
Write-Host "https://$DOMAIN" -ForegroundColor Green
Write-Host ""
