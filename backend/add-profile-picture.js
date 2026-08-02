const pool = require("./db");

async function addProfilePicture() {
  try {
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS profile_picture TEXT
    `);
    
    console.log("✅ Successfully added profile_picture column");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

addProfilePicture();
