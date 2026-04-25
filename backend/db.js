const mysql = require("mysql2");

const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Savi@1914",
    database: "garage_management_system"
});

db.connect(err => {
    if (err) throw err;
    console.log("Database Connected ✅");
});

module.exports = db;