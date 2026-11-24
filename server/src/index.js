require("dotenv").config();
require("express-async-errors");                    // lets async route errors reach the error handler
const express = require("express"), http = require("http"), cors = require("cors");
const helmet = require("helmet"), rate = require("express-rate-limit"), mongoose = require("mongoose");
const jwt = require("jsonwebtoken"), { Server } = require("socket.io");
const { User, Message } = require("./models"), canChat = require("./chatAccess");
const { startReminderPush } = require("./lib/push"), { startJobs } = require("./lib/jobs"), { setIo } = require("./lib/notify");
const origin = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(",") : "*";

const app = express();
app.use(helmet(), cors({ origin }), express.json(), rate({ windowMs: 60000, max: 120 }));
app.get("/api/health", (_, r) => r.json({ ok: true }));
app.use("/api/auth", rate({ windowMs: 60000, max: 20 }), require("./routes/auth"));
app.use("/api/doctors", require("./routes/doctors"));
app.use("/api/appointments", require("./routes/appointments"));
app.use("/api/reminders", require("./routes/reminders"));
app.use("/api/records", require("./routes/records"));
app.use("/api/symptoms", require("./routes/symptoms"));
app.use("/api/reviews", require("./routes/reviews"));
app.use("/api/sos", require("./routes/sos"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/prescriptions", require("./routes/prescriptions"));
app.use("/api/devices", require("./routes/devices"));
app.use("/api/notifications", require("./routes/notifications"));
app.use("/api/vitals", require("./routes/vitals"));
app.use("/api/patients", require("./routes/patients"));
app.use((e, _q, r, _n) => { console.error(e); r.status(e.status || (e.name === "MulterError" ? 400 : 500)).json({ error: e.status || e.name === "MulterError" ? e.message : "Server error" }); });

const server = http.createServer(app);
const io = new Server(server, { cors: { origin } }); setIo(io);
io.use(async (s, next) => {                         // socket login with the same JWT
  try {
    const t = jwt.verify(s.handshake.auth.token, process.env.JWT_SECRET);
    s.user = await User.findById(t.id).select("name");
    s.user ? next() : next(new Error("auth"));
  } catch { next(new Error("auth")); }
});
io.on("connection", (s) => {
  s.join("user:" + s.user._id);                       // personal room for live notifications
  s.on("join", async (room, ack) => {
    const ok = await canChat(s.user._id, room);
    if (ok) s.join(room);
    if (typeof ack === "function") ack(ok);
  });
  s.on("chat", async ({ room, text } = {}) => {
    if (String(room).startsWith("user:") || !s.rooms.has(room) || !text || String(text).length > 500) return;
    io.to(room).emit("chat", await Message.create({ room, sender: String(s.user._id), name: s.user.name, text: String(text) }));
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => server.listen(process.env.PORT || 5000, () => { console.log("MediSync API running"); startReminderPush(); startJobs(); }))
  .catch((e) => { console.error("DB error:", e.message); process.exit(1); });
