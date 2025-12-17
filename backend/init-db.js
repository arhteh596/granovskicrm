const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    user: 'postgres',
    password: 'Qweras190!',
    host: '127.0.0.1',
    port: 5432,
    database: 'crm_calls_db'
});

const initDb = async () => {
    try {
        console.log('🔄 Reading schema file...');
        const schemaPath = path.join(__dirname, 'src', 'db', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('🔄 Executing schema...');
        await pool.query(schema);

        console.log('✅ Database initialized successfully!');
        console.log('');
        console.log('Default admin credentials:');
        console.log('Username: admin');
        console.log('Password: admin123');

        process.exit(0);
    } catch (err) {
        console.error('❌ Database initialization error:', err.message);
        console.error(err);
        process.exit(1);
    }
};

initDb();
