const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.connect()
  .then(() => console.log("Database Connected ✅"))
  .catch(err => console.log("Database Error ❌", err));

module.exports = pool;