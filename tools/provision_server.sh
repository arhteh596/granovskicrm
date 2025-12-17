#!/usr/bin/env bash
set -euo pipefail

# Настройка переменных
DOMAIN=${DOMAIN:-Granovskiy-crm.online}
PROJECT_DIR=${PROJECT_DIR:-/srv/crm}
SWAP_SIZE_GB=${SWAP_SIZE_GB:-4}
TIMEZONE=${TIMEZONE:-Etc/UTC}

log() { echo -e "\e[1;32m[INFO]\e[0m $*"; }
warn() { echo -e "\e[1;33m[WARN]\e[0m $*"; }
err()  { echo -e "\e[1;31m[ERR ]\e[0m $*"; }

require_root() {
  if [[ $EUID -ne 0 ]]; then
    err "Запустите скрипт от root"; exit 1;
  fi
}

install_base() {
  log "Обновление пакетов и установка базовых утилит"
  apt update
  apt install -y ca-certificates curl gnupg lsb-release ufw jq
}

install_docker() {
  if command -v docker &>/dev/null; then
    log "Docker уже установлен: $(docker --version)"
  else
    log "Установка Docker Engine"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
  fi
  if docker compose version &>/dev/null; then
    log "Docker Compose plugin: $(docker compose version)"
  else
    warn "Docker Compose plugin не найден. Проверьте установку docker-ce-plugin-compose"
  fi
}

setup_firewall() {
  log "Настройка UFW (SSH/80/443)"
  ufw allow OpenSSH || true
  ufw allow 80 || true
  ufw allow 443 || true
  ufw --force enable || true
  ufw status
}

setup_swap() {
  if [[ $SWAP_SIZE_GB -gt 0 ]]; then
    if swapon --show | grep -q "/swapfile"; then
      log "Swap уже настроен"
    else
      log "Создание swap ${SWAP_SIZE_GB}G"
      fallocate -l ${SWAP_SIZE_GB}G /swapfile || dd if=/dev/zero of=/swapfile bs=1G count=${SWAP_SIZE_GB}
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      if ! grep -q "/swapfile" /etc/fstab; then
        echo "/swapfile none swap sw 0 0" >> /etc/fstab
      fi
      sysctl vm.swappiness=10
      sysctl vm.vfs_cache_pressure=50
      echo "vm.swappiness=10" > /etc/sysctl.d/99-swap.conf
      echo "vm.vfs_cache_pressure=50" >> /etc/sysctl.d/99-swap.conf
    fi
  fi
}

setup_timezone() {
  log "Установка таймзоны: ${TIMEZONE}"
  timedatectl set-timezone "${TIMEZONE}" || true
  timedatectl
}

prepare_project_dir() {
  log "Подготовка директории проекта: ${PROJECT_DIR}"
  mkdir -p "${PROJECT_DIR}"
}

configure_domain_in_caddyfile() {
  local caddyfile="${PROJECT_DIR}/Caddyfile"
  if [[ -f "$caddyfile" ]]; then
    log "Проверка домена в Caddyfile (${caddyfile})"
    if ! grep -q "${DOMAIN}" "$caddyfile"; then
      warn "В Caddyfile не найден ${DOMAIN}. Попробую заменить домен автоматически."
      sed -i "s/Granovskiy-crm\.online/${DOMAIN}/g" "$caddyfile" || true
    fi
  else
    warn "Файл Caddyfile не найден. Убедитесь, что проект скопирован в ${PROJECT_DIR}"
  fi
}

bring_up_stack() {
  log "Запуск контейнеров (docker compose up -d --build)"
  cd "${PROJECT_DIR}"
  docker compose up -d --build
  log "Список контейнеров:"
  docker compose ps
}

print_checks() {
  cat <<EOF

Проверки:
- Логи Caddy:   docker logs -f crm-caddy
- Логи backend: docker logs -f crm-backend-local
- Логи frontend:docker logs -f crm-frontend-local
- Логи postgres:docker logs -f crm-postgres-local

Проверьте HTTP(S):
- https://${DOMAIN}/           — фронтенд
- https://${DOMAIN}/api/health — бэкенд health

Если сертификат не выпустился:
- Убедитесь, что DNS A-запись '${DOMAIN}' указывает на ваш сервер.
- Порты 80/443 доступны из интернета (UFW/провайдер). 
EOF
}

main() {
  require_root
  install_base
  install_docker
  setup_firewall
  setup_swap
  setup_timezone
  prepare_project_dir
  configure_domain_in_caddyfile
  bring_up_stack
  print_checks
}

main "$@"
