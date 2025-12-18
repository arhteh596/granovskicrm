import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Pool, PoolConfig } from 'pg';

// Runs DB schema + SQL migrations.
// Safe to run on every container start (migrations are written to be idempotent).

dotenv.config();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const resolveSsl = (): PoolConfig['ssl'] => {
    const val = (process.env.DB_SSL || '').toLowerCase();
    if (val === 'true' || val === '1' || val === 'require' || val === 'on') {
        const strict = (process.env.DB_SSL_STRICT || '').toLowerCase();
        const rejectUnauthorized = strict === 'true' || strict === '1';
        return { rejectUnauthorized } as any;
    }
    return undefined;
};

const getPoolConfig = (): PoolConfig => {
    const connectionString = process.env.DATABASE_URL;
    if (connectionString) {
        return {
            connectionString,
            ssl: resolveSsl(),
        } as PoolConfig;
    }

    return {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: resolveSsl(),
    } as PoolConfig;
};

const listSqlFiles = (dir: string): string[] => {
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((f) => f.toLowerCase().endsWith('.sql'))
        .sort((a, b) => a.localeCompare(b))
        .map((f) => path.join(dir, f));
};

const applySqlFile = async (pool: Pool, filePath: string) => {
    const sql = fs.readFileSync(filePath, 'utf8');
    const label = path.relative(process.cwd(), filePath);

    // Skip empty files
    if (!sql.trim()) {
        console.log(`⏭️  Skip empty migration: ${label}`);
        return;
    }

    console.log(`▶️  Applying: ${label}`);
    await pool.query(sql);
    console.log(`✅ Done: ${label}`);
};

const main = async () => {
    const pool = new Pool(getPoolConfig());

    // Retry DB connectivity (important for docker compose start order)
    const maxAttempts = parseInt(process.env.DB_MIGRATE_RETRIES || '30', 10);
    const delayMs = parseInt(process.env.DB_MIGRATE_RETRY_DELAY_MS || '2000', 10);

    let lastErr: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await pool.query('SELECT 1');
            lastErr = null;
            break;
        } catch (e) {
            lastErr = e;
            console.log(
                `⏳ DB not ready (attempt ${attempt}/${maxAttempts}). Waiting ${delayMs}ms...`
            );
            await sleep(delayMs);
        }
    }

    if (lastErr) {
        console.error('❌ DB still not reachable, aborting migrations.');
        throw lastErr;
    }

    // Locations in compiled image:
    // dist/db/schema.sql
    // dist/db/migrations/*.sql
    // dist/migrations/*.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    const dbMigrationsDir = path.join(__dirname, 'migrations');
    const appMigrationsDir = path.join(__dirname, '..', 'migrations');

    try {
        console.log('🧩 Running base schema...');
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`schema.sql not found at ${schemaPath}. Build/copy step is missing.`);
        }
        await applySqlFile(pool, schemaPath);

        const migrationFiles = [
            ...listSqlFiles(dbMigrationsDir),
            ...listSqlFiles(appMigrationsDir),
        ];

        console.log(`🧩 Found ${migrationFiles.length} migration file(s).`);
        for (const file of migrationFiles) {
            await applySqlFile(pool, file);
        }

        console.log('🎉 DB migrations completed successfully.');
    } finally {
        await pool.end();
    }
};

main().catch((err) => {
    console.error('❌ Migration runner failed:', err?.message || err);
    console.error(err);
    process.exit(1);
});
