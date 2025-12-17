const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_1XhBspnwkIR5@ep-lucky-boat-a4csq72g-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require',
    ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
    try {
        const result = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
        console.log('✅ Подключение к БД успешно!');
        console.log('📊 Таблицы в базе данных:');
        result.rows.forEach((row, i) => {
            console.log(`   ${i + 1}. ${row.tablename}`);
        });

        // Проверим, есть ли пользователь admin
        const userCheck = await pool.query("SELECT username, role FROM users WHERE username = 'admin'");
        if (userCheck.rows.length > 0) {
            console.log('\n👤 Пользователь admin найден:');
            console.log(`   Role: ${userCheck.rows[0].role}`);
        } else {
            console.log('\n⚠️ Пользователь admin не найден');
        }
    } catch (error) {
        console.error('❌ Ошибка подключения к БД:', error.message);
    } finally {
        await pool.end();
    }
}

checkDatabase();
