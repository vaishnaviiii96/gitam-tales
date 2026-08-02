const pool = require('./db');
const { hashPassword } = require('./utils/hash');

async function run() {
  try {
    const hashed = await hashPassword('password123');
    await pool.query('UPDATE users SET password = $1', [hashed]);
    await pool.query('UPDATE users SET name = $1 WHERE email = $2', ['Gitam Admin', 'admin@gitam.in']);
    console.log('Successfully reset all passwords to: password123');
    console.log('Successfully renamed admin to Gitam Admin.');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

run();
