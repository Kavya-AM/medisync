const r = require("express").Router(), bcrypt = require("bcryptjs"), crypto = require("crypto");
const { User, Doctor, Appointment } = require("../models"), { protect } = require("../auth"), { toCsv } = require("../lib/csv");
r.use(protect("admin"));
const esc = (x) => String(x || "").replace(/[^\w @.+-]/g, "").slice(0, 60);

r.get("/stats", async (_q, res) => {
  const apts = await Appointment.find().populate("doctor", "name fee");
  const byDoctor = {}, byDay = {};
  apts.forEach((a) => {
    const n = a.doctor?.name || "Unknown";
    byDoctor[n] = (byDoctor[n] || 0) + 1;
    byDay[a.date] = (byDay[a.date] || 0) + 1;
  });
  res.json({
    patients: await User.countDocuments({ role: "patient" }), doctors: await Doctor.countDocuments(),
    appointments: apts.length, cancelled: apts.filter((a) => a.status === "cancelled").length,
    revenue: apts.filter((a) => a.paid).reduce((s, a) => s + (a.doctor?.fee || 0), 0), byDoctor, byDay,
  });
});

// People list with role filter and search.
r.get("/users", async (q, s) => {
  const f = {};
  if (["patient", "doctor", "admin"].includes(q.query.role)) f.role = q.query.role;
  const t = esc(q.query.q);
  if (t) { const re = new RegExp(t.replace(/[.+]/g, "\\$&"), "i"); f.$or = [{ name: re }, { email: re }]; }
  s.json(await User.find(f).select("name email role active createdAt").sort("-createdAt").limit(200));
});

r.patch("/users/:id/active", async (q, s) => {
  if (String(q.params.id) === String(q.user.id)) return s.status(400).json({ error: "You cannot deactivate your own account" });
  const u = await User.findByIdAndUpdate(q.params.id, { active: !!q.body.active }, { new: true }).select("name email role active createdAt");
  u ? s.json(u) : s.status(404).json({ error: "Not found" });
});

// Creates the login and the doctor profile together. The temporary password is returned once.
r.post("/doctors", async (q, s) => {
  const { name, email, specialty } = q.body, fee = Number(q.body.fee), experience = Number(q.body.experience);
  if (!name || String(name).trim().length < 3 || !/^\S+@\S+\.\S+$/.test(email || "") || !specialty) return s.status(400).json({ error: "Enter name, email and specialty" });
  if (!(fee >= 100 && fee <= 10000)) return s.status(400).json({ error: "Fee must be between 100 and 10000" });
  if (await User.findOne({ email: String(email).toLowerCase() })) return s.status(409).json({ error: "Email already registered" });
  const tempPassword = crypto.randomBytes(6).toString("base64url");
  const u = await User.create({ name: String(name).trim(), email, password: await bcrypt.hash(tempPassword, 10), role: "doctor" });
  await Doctor.create({ name: u.name, specialty: String(specialty).trim().slice(0, 40), fee, experience: Math.max(0, Math.min(60, experience || 0)), user: u._id });
  s.status(201).json({ email: u.email, tempPassword });
});

const visits = (query) => {
  const f = {};
  if (["booked", "done", "cancelled"].includes(query.status)) f.status = query.status;
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.date || "")) f.date = query.date;
  return Appointment.find(f).populate("patient", "name email").populate("doctor", "name fee").sort("-date -time").limit(500);
};
r.get("/appointments", async (q, s) => s.json(await visits(q.query)));
r.get("/export/appointments.csv", async (q, s) => {
  const list = await visits(q.query);
  s.setHeader("Content-Type", "text/csv"); s.setHeader("Content-Disposition", "attachment; filename=appointments.csv");
  s.send(toCsv(["Date", "Time", "Patient", "Email", "Doctor", "Status", "Paid", "Fee"],
    list.map((a) => [a.date, a.time, a.patient?.name, a.patient?.email, a.doctor?.name, a.status, a.paid ? "yes" : "no", a.doctor?.fee])));
});
module.exports = r;
