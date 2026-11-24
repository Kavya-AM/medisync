const r = require("express").Router(), bcrypt = require("bcryptjs"), crypto = require("crypto");
const { User, Appointment, Record, Reminder, Vital, Notification, Prescription, Device, SosAlert, Review } = require("../models"), { sign, protect } = require("../auth"), sendMail = require("../lib/mail");
const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");

r.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !/^\S+@\S+\.\S+$/.test(email || "") || (password || "").length < 6)
    return res.status(400).json({ error: "Enter name, valid email and a password of 6+ characters" });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(409).json({ error: "Email already registered" });
  const u = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
  res.status(201).json({ token: sign(u), user: { id: u._id, name: u.name, role: u.role } });
});

r.post("/login", async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || "").toLowerCase() });
  if (!u || !(await bcrypt.compare(req.body.password || "", u.password)))
    return res.status(401).json({ error: "Wrong email or password" });
  if (u.active === false) return res.status(403).json({ error: "This account has been deactivated. Contact the clinic." });
  res.json({ token: sign(u), user: { id: u._id, name: u.name, role: u.role } });
});

// Same answer whether or not the email exists, so nobody can probe for accounts.
r.post("/forgot", async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || "").toLowerCase() });
  if (u) {
    const token = crypto.randomBytes(32).toString("hex");
    u.resetHash = sha(token); u.resetExpires = Date.now() + 3600e3; await u.save();
    const base = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0];
    await sendMail(u.email, "Reset your MediSync password", `Open this link within 1 hour to set a new password:\n${base}/?reset=${token}`);
  }
  res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
});

r.post("/reset", async (req, res) => {
  const { token, password } = req.body;
  if (!token || (password || "").length < 6) return res.status(400).json({ error: "Enter a password of 6+ characters" });
  const u = await User.findOne({ resetHash: sha(String(token)), resetExpires: { $gt: Date.now() } });
  if (!u) return res.status(400).json({ error: "This link is invalid or has expired" });
  u.password = await bcrypt.hash(password, 10); u.resetHash = undefined; u.resetExpires = undefined; await u.save();
  res.json({ ok: true });
});

const SAFE = "-password -resetHash -resetExpires";
r.get("/me", protect(), async (req, res) => res.json(await User.findById(req.user.id).select(SAFE)));

// Edit own profile. Only whitelisted fields, each checked.
r.patch("/me", protect(), async (req, res) => {
  const b = req.body, set = {};
  if (b.name !== undefined) { const n = String(b.name).trim(); if (n.length < 2 || n.length > 80) return res.status(400).json({ error: "Name must be 2 to 80 characters" }); set.name = n; }
  if (b.phone !== undefined) { const p = String(b.phone).trim(); if (p && !/^\+?[\d\s-]{7,15}$/.test(p)) return res.status(400).json({ error: "Enter a valid phone number" }); set.phone = p; }
  if (b.dob !== undefined) { if (b.dob && (!/^\d{4}-\d{2}-\d{2}$/.test(b.dob) || b.dob > new Date().toISOString().slice(0, 10) || b.dob < "1900-01-01")) return res.status(400).json({ error: "Enter a valid date of birth" }); set.dob = b.dob || undefined; }
  if (b.gender !== undefined) { if (!["", "female", "male", "other"].includes(b.gender)) return res.status(400).json({ error: "Invalid gender" }); set.gender = b.gender; }
  if (b.bloodGroup !== undefined) { if (!["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].includes(b.bloodGroup)) return res.status(400).json({ error: "Invalid blood group" }); set.bloodGroup = b.bloodGroup; }
  if (b.heightCm !== undefined) { if (b.heightCm === "" || b.heightCm === null) set.heightCm = undefined; else { const h = Number(b.heightCm); if (!(h >= 50 && h <= 250)) return res.status(400).json({ error: "Height must be 50 to 250 cm" }); set.heightCm = h; } }
  for (const k of ["allergies", "conditions"]) if (b[k] !== undefined) set[k] = String(b[k]).slice(0, 300);
  if (b.shareWithDoctors !== undefined) set.shareWithDoctors = !!b.shareWithDoctors;
  const u = await User.findByIdAndUpdate(req.user.id, set, { new: true, runValidators: true }).select(SAFE);
  res.json(u);
});

r.post("/change-password", protect(), async (req, res) => {
  const { current, password } = req.body, u = await User.findById(req.user.id);
  if (!u || !(await bcrypt.compare(current || "", u.password))) return res.status(400).json({ error: "Current password is wrong" });
  if ((password || "").length < 6) return res.status(400).json({ error: "New password must be 6+ characters" });
  u.password = await bcrypt.hash(password, 10); await u.save();
  res.json({ ok: true });
});

// Everything MediSync stores about the signed-in person, as one JSON download.
r.get("/export", protect(), async (req, res) => {
  const id = req.user.id, u = await User.findById(id).select(SAFE).lean();
  const data = {
    exportedAt: new Date().toISOString(), profile: u,
    appointments: await Appointment.find({ patient: id }).lean(), prescriptions: await Prescription.find({ patient: id }).lean(),
    records: (await Record.find({ patient: id }).lean()).map(({ file, ...x }) => x), reminders: await Reminder.find({ patient: id }).lean(),
    readings: await Vital.find({ patient: id }).lean(), notifications: await Notification.find({ user: id }).lean(),
  };
  res.setHeader("Content-Disposition", "attachment; filename=medisync-my-data.json");
  res.json(data);
});

// Delete own account. Patients lose personal data; visits that already happened stay for the doctor's records but lose the link.
r.delete("/me", protect(), async (req, res) => {
  const u = await User.findById(req.user.id);
  if (!u || !(await bcrypt.compare(req.body.password || "", u.password))) return res.status(400).json({ error: "Password is wrong" });
  if (u.role !== "patient") return res.status(403).json({ error: "Ask an admin to remove this account" });
  const files = await Record.find({ patient: u._id }).select("file");
  files.forEach((f) => require("../lib/files").remove(f.file));
  await Appointment.updateMany({ patient: u._id, status: "booked" }, { status: "cancelled" });
  await Promise.all([Record.deleteMany({ patient: u._id }), Reminder.deleteMany({ patient: u._id }), Vital.deleteMany({ patient: u._id }),
    Notification.deleteMany({ user: u._id }), Device.deleteMany({ user: u._id }), SosAlert.deleteMany({ patient: u._id }), Review.deleteMany({ patient: u._id })]);
  await User.deleteOne({ _id: u._id });
  res.json({ ok: true });
});
module.exports = r;
