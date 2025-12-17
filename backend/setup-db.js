const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Create separate pool for creating database
const systemPool = new Pool({
    user: 'postgres',
    password: 'Qweras190!',
    host: '127.0.0.1',
    port: 5432,
    database: 'postgres' // Connect to system database
});

const initDb = async () => {
    try {
        console.log('🔄 Dropping existing database...');
        await systemPool.query('DROP DATABASE IF EXISTS crm_calls_db');

        console.log('🔄 Creating new database...');
        await systemPool.query('CREATE DATABASE crm_calls_db ENCODING \'UTF8\'');

        await systemPool.end();

        // Now connect to the new database
        const appPool = new Pool({
            user: 'postgres',
            password: 'Qweras190!',
            host: '127.0.0.1',
            port: 5432,
            database: 'crm_calls_db'
        });

        console.log('🔄 Reading schema file...');
        const schemaPath = path.join(__dirname, 'schema_english.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('🔄 Executing schema...');
        await appPool.query(schema);

        console.log('✅ Database initialized successfully!');
        console.log('');
        console.log('Database: crm_calls_db');
        console.log('Default admin credentials:');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('');
        console.log('Connection details:');
        console.log('Host: localhost');
        console.log('Port: 5432');
        console.log('Database: crm_calls_db');
        console.log('User: postgres');

        await appPool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Database initialization error:', err.message);
        process.exit(1);
    }
};

initDb();