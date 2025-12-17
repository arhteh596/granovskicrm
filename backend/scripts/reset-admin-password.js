const { Pool } = require('pg');
const bcrypt = require('bcrypt');

(async () => {
    try {
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        const pool = new Pool({
            host: process.env.DB_HOST,
            port: Number(process.env.DB_PORT || 5432),
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: undefined,
        });

        const hash = await bcrypt.hash(password, 10);
        const res = await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2 RETURNING id, username', [hash, 'admin']);

        if (res.rowCount === 0) {
            console.log('Admin user not found, creating...');
            await pool.query(
                'INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, $4)',
                ['admin', 'Главный Администратор', hash, 'admin']
            );
            console.log('Admin user created.');
        } else {
            console.log('Admin password updated.');
        }

        console.log('Login with: admin /', password);
        await pool.end();
        process.exit(0);
    } catch (e) {
        console.error('Reset failed:', e.message);
        process.exit(1);
    }
})();
