const pool = require('./db');

async function createTalesTable() {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS tales (
                id SERIAL PRIMARY KEY,
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(100),
                description TEXT,
                tags TEXT,
                event_date TIMESTAMP,
                cover_image VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        await pool.query(query);
        console.log('Tales table created successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error creating tales table:', error);
        process.exit(1);
    }
}

createTalesTable();
