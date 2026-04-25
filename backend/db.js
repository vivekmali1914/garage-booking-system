const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 4000,
  // ADD THIS SECTION BELOW
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  }
});

db.connect((err) => {
  if (err) {
    console.error('Database Error ❌', err.message);
    return;
  }
  console.log('Connected to TiDB Database! ✅');
});

module.exports = db;
