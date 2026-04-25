const mysql = require("mysql2");
require('dotenv').config(); // Ensure you have dotenv installed to read variables locally

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error("Database Error ❌", err.message);
    } else {
        console.log("Database Connected ✅");
        connection.release();
    }
});

module.exports = db;
