// Runs sql/schema.sql using the credentials in .env  ->  npm run db:init
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

(async () => {
  const conn = await mysql.createConnection({
    host: env.db.host, port: env.db.port, user: env.db.user, password: env.db.password, multipleStatements: true
  });
  try {
    await conn.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('Database schema created (or already up to date).');
  } finally {
    await conn.end();
  }
})().catch((err) => { console.error('Database setup failed:', err.message); process.exit(1); });
