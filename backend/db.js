const mysql = require("mysql2");

const db = mysql.createPool(process.env.MYSQL_URL);

db.getConnection((err, connection) => {
    if (err) {
        console.log("Database Error ❌", err);
    } else {
        console.log("Database Connected ✅");
        connection.release();
    }
});

module.exports = db;
