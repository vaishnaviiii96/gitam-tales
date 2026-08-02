const pool = require("./db");

async function addNameColumn() {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'User'
    `);
    
    console.log("✅ Successfully added 'name' column to users table");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

addNameColumn();
