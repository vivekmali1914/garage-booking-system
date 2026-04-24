const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

// TEST API
app.get("/", (req, res) => {
    res.send("Server Running ✅");
});

// GET GARAGES
app.get("/garages", (req, res) => {
    db.query("SELECT * FROM garages", (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});

// START SERVER
app.listen(3000, () => {
    console.log("Server running on port 3000 🚀");
});

app.get("/services/:garageId", (req, res) => {
    db.query(
        "SELECT * FROM services WHERE garage_id=?",
        [req.params.garageId],
        (err, result) => {
            if (err) return res.send(err);
            res.json(result);
        }
    );
});



function checkSlotAvailability(garage_id, date, time, callback) {
    const query = `
        SELECT COUNT(*) AS count 
        FROM appointments
        WHERE garage_id=? AND date=? AND time=?
    `;

    db.query(query, [garage_id, date, time], (err, result) => {
        if (err) return callback(err);

        const booked = result[0].count;

        db.query(
            "SELECT capacity FROM garages WHERE id=?",
            [garage_id],
            (err2, res2) => {

                const capacity = res2[0].capacity;

                callback(null, booked < capacity);
            }
        );
    });
}


function getServiceDuration(service_id, callback) {
    db.query(
        "SELECT duration FROM services WHERE id=?",
        [service_id],
        (err, result) => {

            if (err) return callback(err);

            if (!result || result.length === 0) {
                return callback(new Error("Service not found ❌"));
            }

            callback(null, result[0].duration);
        }
    );
}


function generateSlots(startTime, duration) {
    let slots = [];
    let current = new Date(`1970-01-01T${startTime}`);

    let count = duration / 30;

    for (let i = 0; i < count; i++) {
        let t = current.toTimeString().slice(0,5);
        slots.push(t);
        current.setMinutes(current.getMinutes() + 30);
    }

    return slots;
}


app.post("/book", (req, res) => {
    const { user_id, garage_id, vehicle_id, service_id, date, time, service_type, address } = req.body;
    
    if(!date || !time){
    return res.send("Please select date & time ❌");
    }
    
    getServiceDuration(service_id, (err, duration) => {

        if (err) {
        return res.send(err.message);
         }
         
        let slots = generateSlots(time, duration);

        const query = `
            SELECT time, COUNT(*) as count 
            FROM appointments
            WHERE garage_id=? AND date=? AND time IN (?)
            GROUP BY time
        `;

        db.query(query, [garage_id, date, slots], (err, results) => {

            db.query(
                "SELECT capacity FROM garages WHERE id=?",
                [garage_id],
                (err2, res2) => {

                    const capacity = res2[0].capacity;

                    for (let r of results) {
                        if (r.count >= capacity) {
                            return res.send("Slot Not Available ❌");
                        }
                    }

                    db.query(
                        `INSERT INTO appointments 
                        (user_id, garage_id, vehicle_id, service_id, date, time, service_type, address)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                        [user_id, garage_id, vehicle_id, service_id, date, time, service_type, address],
                        (err) => {
                            if (err) return res.send(err);

                            res.send("Booking Confirmed ✅");
                        }
                    );
                }
            );
        });
    });
});

const bcrypt = require("bcrypt");

app.post("/register", async (req, res) => {
    const { name, email, password, role } = req.body;
    
    if(!name || !email || !password || !role){
    return res.send("All fields required ❌");
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const query = `
            INSERT INTO users (name, email, password, role)
            VALUES (?, ?, ?, ?)
        `;

        db.query(query, [name, email, hashedPassword, role], (err) => {
            if (err) return res.send(err);

            res.send("User Registered ✅");
        });

    } catch (err) {
        res.send(err);
    }
});


app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE email=?",
        [email],
        async (err, result) => {

            if (err) return res.send(err);

            if (result.length === 0) {
                return res.send("User not found ❌");
            }

            const user = result[0];

            const bcrypt = require("bcrypt");
            const isMatch = await bcrypt.compare(password, user.password);

            if (!isMatch) {
                return res.send("Wrong password ❌");
            }

            // 🔥 get garage for owner
            if (user.role === "garage_owner") {
                db.query(
                    "SELECT id FROM garages WHERE owner_id=?",
                    [user.id],
                    (err2, garageRes) => {

                        if (garageRes.length > 0) {
                            user.garage_id = garageRes[0].id;
                        }

                        res.send({
                            message: "Login successful ✅",
                            user: user
                        });
                    }
                );
            } else {
                res.send({
                    message: "Login successful ✅",
                    user: user
                });
            }
        }
    );
});



app.get("/garage/:id/appointments", (req, res) => {
    const garageId = req.params.id;

    const query = `
        SELECT a.*, u.name as customer_name, s.name as service_name
        FROM appointments a
        JOIN users u ON a.user_id = u.id
        JOIN services s ON a.service_id = s.id
        WHERE a.garage_id = ?
        ORDER BY date, time
    `;

    db.query(query, [garageId], (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});

app.put("/update-status/:id", (req, res) => {
    const appointmentId = req.params.id;
    const { status } = req.body;

    db.query(
        "UPDATE appointments SET status=? WHERE id=?",
        [status, appointmentId],
        (err) => {
            if (err) return res.send(err);
            res.send("Status Updated ✅");
        }
    );
});


app.post("/add-garage", (req, res) => {
    const { name, location, capacity, opening_time, closing_time, owner_id } = req.body;

    const query = `
        INSERT INTO garages (name, location, capacity, opening_time, closing_time, owner_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.query(
        query,
        [name, location, capacity, opening_time, closing_time, owner_id],
        (err) => {
            if (err) return res.send(err);

            res.send("Garage Added Successfully ✅");
        }
    );
});

app.post("/add-service", (req, res) => {
    const { name, duration, price, garage_id } = req.body;

    const query = `
        INSERT INTO services (name, duration, price, garage_id)
        VALUES (?, ?, ?, ?)
    `;

    db.query(query, [name, duration, price, garage_id], (err) => {
        if (err) return res.send(err);

        res.send("Service Added ✅");
    });
});

app.get("/vehicles/:userId", (req, res) => {
    db.query(
        "SELECT * FROM vehicles WHERE user_id=?",
        [req.params.userId],
        (err, result) => {
            if (err) return res.send(err);
            res.json(result);
        }
    );
});


app.post("/add-vehicle", (req, res) => {
    const { user_id, model, number_plate } = req.body;

    const query = `
        INSERT INTO vehicles (user_id, model, number_plate)
        VALUES (?, ?, ?)
    `;

    db.query(query, [user_id, model, number_plate], (err) => {
        if (err) return res.send(err);

        res.send("Vehicle Added ✅");
    });
});


app.post("/emergency", (req, res) => {

    const { user_id, vehicle_id, problem, latitude, longitude } = req.body;
    
    if(!user_id || !vehicle_id || !problem || !latitude || !longitude){
    return res.send("All fields required ❌");
}
    db.query(
    `INSERT INTO emergency_requests 
    (user_id, vehicle_id, problem, latitude, longitude, status)
    VALUES (?, ?, ?, ?, ?, 'Pending')`,
        [user_id, vehicle_id, problem, latitude, longitude],
        (err) => {
            if (err) return res.send(err);
            res.send("Emergency request sent 🚨");
        }
    );
});

app.get("/emergency-requests/:garageId", (req, res) => {
   
    const garageId = req.params.garageId;

    db.query(
        "SELECT latitude, longitude FROM garages WHERE id=?",
        [garageId],
        (err, gResult) => {

            if(!gResult.length || !gResult[0].latitude){
                return res.json([]);
            }

            let gLat = gResult[0].latitude;
            let gLng = gResult[0].longitude;

            db.query(
                "SELECT * FROM emergency_requests WHERE status='Pending'",
                (err, requests) => {

                    let nearby = [];

                    requests.forEach(r => {

                        let distance = getDistance(
                            gLat, gLng,
                            r.latitude, r.longitude
                        );

                        console.log("Distance:", distance);

                        if(distance <= 50){   // 🔥 TEMP FIX
                            nearby.push(r);
                        }
                    });

                    res.json(nearby);
                }
            );
        }
    );
});


function getDistance(lat1, lon1, lat2, lon2) {

    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
}


app.put("/accept-emergency/:id", (req, res) => {

    const requestId = req.params.id;
    const { garage_id } = req.body;

    // get garage location
    db.query(
        "SELECT latitude, longitude FROM garages WHERE id=?",
        [garage_id],
        (err, gRes) => {

            if(err) return res.send(err);
            if(!gRes.length){
                return res.send("Garage not found ❌");
            }

            const gLat = gRes[0].latitude;
            const gLng = gRes[0].longitude;

            // get request location
            db.query(
                "SELECT latitude, longitude FROM emergency_requests WHERE id=?",
                [requestId],
                (err2, rRes) => {

                    if(err2) return res.send(err2);
                    if(!rRes.length){
                        return res.send("Request not found ❌");
                    }

                    const rLat = rRes[0].latitude;
                    const rLng = rRes[0].longitude;

                    let distance = getDistance(gLat, gLng, rLat, rLng);

                    let eta = Math.ceil((distance / 40) * 60);

                    db.query(
                        `UPDATE emergency_requests 
                         SET status='Accepted', accepted_by=?, eta=? 
                         WHERE id=?`,
                        [garage_id, eta, requestId],
                        (err3) => {
                            if(err3) return res.send(err3);

                            res.send("Request Accepted ✅");
                        }
                    );
                }
            );
        }
    );
});



app.get("/my-emergency/:userId", (req, res) => {

    db.query(
        `SELECT * FROM emergency_requests 
         WHERE user_id=? 
         ORDER BY id DESC LIMIT 1`,
        [req.params.userId],
        (err, result) => {
            
            if(err) return res.send(err);
            if(result.length === 0){
                return res.json(null);
            }

            res.json(result[0]);
        }
    );
});



app.get("/my-bookings/:userId", (req, res) => {

    const userId = req.params.userId;

    const query = `
        SELECT a.*, s.name AS service_name, g.name AS garage_name
        FROM appointments a
        JOIN services s ON a.service_id = s.id
        JOIN garages g ON a.garage_id = g.id
        WHERE a.user_id = ?
        ORDER BY a.date DESC, a.time DESC
    `;

    db.query(query, [userId], (err, result) => {
        if (err) return res.send(err);
        res.json(result);
    });
});