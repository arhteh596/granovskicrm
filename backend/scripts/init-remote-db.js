const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function resolveSsl() {
    const val = String(process.env.DB_SSL || '').toLowerCase();
    if (['true', '1', 'require', 'on'].includes(val)) {
        const strict = String(process.env.DB_SSL_STRICT || '').toLowerCase();
        const rejectUnauthorized = ['true', '1'].includes(strict);
        return { rejectUnauthorized };
    }
    return undefined;
}

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString && !process.env.DB_HOST) {
        console.error('\u274c Please provide either DATABASE_URL or DB_* variables to connect to your remote Postgres');
        process.exit(1);
    }

    const pool = new Pool(
        connectionString
            ? { connectionString, ssl: resolveSsl() }
            : {
                host: process.env.DB_HOST,
                port: Number(process.env.DB_PORT || 5432),
                database: process.env.DB_NAME,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                ssl: resolveSsl(),
            }
    );

    try {
        const schemaPathCandidates = [
            path.join(__dirname, '..', 'schema_english.sql'),
            path.join(__dirname, '..', 'src', 'db', 'schema.sql'),
        ];

        let schemaPath = null;
        for (const p of schemaPathCandidates) {
            if (fs.existsSync(p)) { schemaPath = p; break; }
        }

        if (!schemaPath) {
            throw new Error('Cannot locate schema file (schema_english.sql or src/db/schema.sql)');
        }

        console.log('\u23f3 Reading schema from', path.relative(process.cwd(), schemaPath));
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('\u23f3 Applying schema to remote database...');
        await pool.query(schema);

        console.log('\u2705 Remote database initialized successfully');
    } catch (err) {
        console.error('\u274c Initialization failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
