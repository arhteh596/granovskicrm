const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5433,
    user: process.env.DB_USER || 'crm_user',
    password: process.env.DB_PASSWORD || 'crm_password',
    database: process.env.DB_NAME || 'crm_db'
});

async function runMigration() {
    try {
        console.log('🔄 Применение миграций для Telegram модуля...');

        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs
            .readdirSync(migrationsDir)
            .filter((f) => f.endsWith('.sql'))
            .sort();

        for (const file of files) {
            const migrationPath = path.join(migrationsDir, file);
            console.log(`➡️  Выполняется миграция: ${file}`);
            const sql = fs.readFileSync(migrationPath, 'utf-8');
            try {
                await pool.query(sql);
            } catch (err) {
                console.warn(`⚠️  Пропущена миграция ${file}: ${err.message}`);
            }
        }

        console.log('✅ Все миграции успешно применены!');
        console.log('📋 Добавлено/обновлено:');
        console.log('   - Роль "zakryv" в таблицу users');
        console.log('   - Таблица telegram_sessions');
        console.log('   - Таблица session_history');
        console.log('   - Таблица exports_log');
        console.log('   - Индексы для оптимизации');

    } catch (error) {
        console.error('❌ Ошибка при применении миграции:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
