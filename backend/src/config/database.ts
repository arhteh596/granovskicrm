import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Helper to resolve SSL options based on env
const resolveSsl = (): PoolConfig['ssl'] => {
    const val = (process.env.DB_SSL || '').toLowerCase();
    if (val === 'true' || val === '1' || val === 'require' || val === 'on') {
        // Some providers require disabling cert verification in hobby tiers
        const strict = (process.env.DB_SSL_STRICT || '').toLowerCase();
        const rejectUnauthorized = strict === 'true' || strict === '1';
        return { rejectUnauthorized } as any;
    }
    return undefined;
};

// Allow using single DATABASE_URL or discrete DB_* variables
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
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: resolveSsl(),
    } as PoolConfig;
};

const pool = new Pool(getPoolConfig());

pool.on('connect', () => {
    console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
    process.exit(-1);
});

// Test connection on startup
pool.query('SELECT NOW()')
    .then(() => {
        console.log('✅ Database connection pool initialized');
    })
    .catch((err) => {
        console.error('❌ Failed to connect to database:', err.message);
        console.error('Connection details:', process.env.DATABASE_URL ? {
            connectionString: (process.env.DATABASE_URL || '').slice(0, 30) + '...'
        } : {
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            database: process.env.DB_NAME,
            user: process.env.DB_USER
        });
    });

export default pool;
