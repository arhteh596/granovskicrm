const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    password: 'Qweras190!',
    host: 'localhost',
    port: 5432,
    database: 'crm_calls_db'
});

const migrate = async () => {
    try {
        await pool.query(`
            ALTER TABLE clients 
            ADD COLUMN IF NOT EXISTS callback_datetime TIMESTAMP,
            ADD COLUMN IF NOT EXISTS callback_notes TEXT,
            ADD COLUMN IF NOT EXISTS transferred_notes TEXT;
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_clients_callback_datetime ON clients(callback_datetime);
        `);

        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_clients_transferred_to ON clients(transferred_to);
        `);

        console.log('✅ Migration successful');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration error:', err);
        process.exit(1);
    }
};

migrate();
