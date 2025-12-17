const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
    user: 'postgres',
    password: 'Qweras190!',
    host: '127.0.0.1',
    port: 5432,
    database: 'crm_calls_db'
});

const updatePassword = async () => {
    try {
        const password = 'admin123';
        const hash = await bcrypt.hash(password, 10);

        console.log('🔄 Updating admin password...');
        console.log('New hash:', hash);

        await pool.query(
            'UPDATE users SET password_hash = $1 WHERE username = $2',
            [hash, 'admin']
        );

        console.log('✅ Admin password updated!');
        console.log('');
        console.log('Login credentials:');
        console.log('Username: admin');
        console.log('Password: admin123');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
};

updatePassword();
