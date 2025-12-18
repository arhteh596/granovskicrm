const bcrypt = require('bcrypt');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'postgres',
  database: 'crm_db',
  user: 'crm_user',
  password: 'crm_password'
});

async function updatePassword() {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    console.log('Generated hash:', hash);
    await pool.query('UPDATE users SET password_hash = $1 WHERE username = $2', [hash, 'admin']);
    console.log('Password updated!');
    const result = await pool.query('SELECT username, password_hash FROM users WHERE username = $1', ['admin']);
    console.log('Result:', result.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

updatePassword();
