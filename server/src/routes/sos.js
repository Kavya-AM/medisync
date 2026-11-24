const r = require("express").Router();
const { User, SosAlert } = require("../models"), { protect } = require("../auth"), sendSms = require("../lib/sms");
r.use(protect("patient"));
r.put("/contact", async (req, res) => {
  const { name, phone } = req.body;
  if (!name || !/^\+?\d{10,13}$/.test(phone || "")) return res.status(400).json({ error: "Enter a name and a 10-digit phone number" });
  await User.findByIdAndUpdate(req.user.id, { emergencyContact: { name, phone } });
  res.json({ ok: true });
});
r.post("/", async (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number") return res.status(400).json({ error: "Location is required" });
  const u = await User.findById(req.user.id);
  if (!u.emergencyContact?.phone) return res.status(400).json({ error: "Save an emergency contact first" });
  const message = `${u.name} needs help. Location: https://maps.google.com/?q=${lat},${lng}`;
  const sms = await sendSms(u.emergencyContact.phone, message);
  await SosAlert.create({ patient: u._id, lat, lng, contactPhone: u.emergencyContact.phone, smsSent: sms.sent });
  res.json({ sent: sms.sent, demo: sms.demo, contact: u.emergencyContact.name, message });
});
module.exports = r;
