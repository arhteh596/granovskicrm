// Telegram API Credentials
// Значения можно переопределить через переменные окружения:
// TELEGRAM_PRIMARY_API_ID, TELEGRAM_PRIMARY_API_HASH, TELEGRAM_FALLBACK_API_ID, TELEGRAM_FALLBACK_API_HASH
export const TELEGRAM_CONFIG = {
    primary: {
        apiId: parseInt(process.env.TELEGRAM_PRIMARY_API_ID || '33104909', 10),
        apiHash: process.env.TELEGRAM_PRIMARY_API_HASH || '788e3ff651cd500926b4be32d07daa45'
    },
    fallback: {
        // Резервные credentials берём из переменных окружения (рекомендуется задать реальные значения)
        apiId: parseInt(process.env.TELEGRAM_FALLBACK_API_ID || '0', 10),
        apiHash: process.env.TELEGRAM_FALLBACK_API_HASH || ''
    }
};

export const SESSION_STORAGE_PATH = process.env.TELEGRAM_SESSION_PATH || './telegram-sessions';
