const pool = require("./db");

async function updateUsersTable() {
  try {
    // Add new columns
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS bio TEXT,
      ADD COLUMN IF NOT EXISTS branch VARCHAR(100),
      ADD COLUMN IF NOT EXISTS year VARCHAR(20),
      ADD COLUMN IF NOT EXISTS campus VARCHAR(50),
      ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
      ADD COLUMN IF NOT EXISTS github_url TEXT,
      ADD COLUMN IF NOT EXISTS profile_picture TEXT
    `);
    
    console.log("✅ Successfully added profile columns to users table");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

updateUsersTable();
