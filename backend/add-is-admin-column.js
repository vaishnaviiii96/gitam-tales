const pool = require('./db');

async function addIsAdminColumn() {
  try {
    console.log("Adding is_admin column to users table...");
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
    `);
    console.log("✅ Successfully added is_admin column!");
  } catch (error) {
    console.error("❌ Error adding column:", error);
  } finally {
    pool.end();
  }
}

addIsAdminColumn();
