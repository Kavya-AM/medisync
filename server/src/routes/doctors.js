const r = require("express").Router();
const { Doctor, Review, Appointment } = require("../models"), { protect } = require("../auth");
const { availability, freeSlots } = require("../lib/slots"), { nowIn } = require("../lib/clock");

r.get("/", async (req, res) => {
  const q = req.query.specialty ? { specialty: new RegExp("^" + req.query.specialty.replace(/[^\w ]/g, ""), "i") } : {};
  const docs = await Doctor.find(q).lean();
  const agg = await Review.aggregate([{ $group: { _id: "$doctor", avg: { $avg: "$stars" }, n: { $sum: 1 } } }]);
  const m = Object.fromEntries(agg.map((x) => [String(x._id), x]));
  res.json(docs.map((d) => ({ ...d, rating: m[d._id] ? +m[d._id].avg.toFixed(1) : null, reviews: m[d._id]?.n || 0 })));
});

r.get("/me/availability", protect("doctor"), async (req, res) => {
  const d = await Doctor.findOne({ user: req.user.id });
  d ? res.json(availability(d)) : res.status(404).json({ error: "No doctor profile" });
});
r.put("/me/availability", protect("doctor"), async (req, res) => {
  const { workDays, startTime, endTime, slotMinutes } = req.body, T = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!Array.isArray(workDays) || !workDays.every((n) => Number.isInteger(n) && n >= 0 && n <= 6) || !workDays.length) return res.status(400).json({ error: "Choose at least one working day" });
  if (!T.test(startTime) || !T.test(endTime) || startTime >= endTime) return res.status(400).json({ error: "End time must be after start time" });
  if (![15, 20, 30, 45, 60].includes(Number(slotMinutes))) return res.status(400).json({ error: "Slot length must be 15, 20, 30, 45 or 60 minutes" });
  const d = await Doctor.findOneAndUpdate({ user: req.user.id }, { workDays, startTime, endTime, slotMinutes: Number(slotMinutes) }, { new: true });
  d ? res.json(availability(d)) : res.status(404).json({ error: "No doctor profile" });
});

// Doctor edits own public profile (fee, experience, languages, short bio).
r.get("/me/profile", protect("doctor"), async (req, res) => {
  const d = await Doctor.findOne({ user: req.user.id }).lean();
  d ? res.json(d) : res.status(404).json({ error: "No doctor profile" });
});
r.put("/me/profile", protect("doctor"), async (req, res) => {
  const fee = Number(req.body.fee), exp = Number(req.body.experience), langs = Array.isArray(req.body.languages) ? req.body.languages : [];
  if (!(fee >= 100 && fee <= 10000)) return res.status(400).json({ error: "Fee must be between 100 and 10000" });
  if (!(exp >= 0 && exp <= 60)) return res.status(400).json({ error: "Experience must be 0 to 60 years" });
  const d = await Doctor.findOneAndUpdate({ user: req.user.id },
    { fee, experience: Math.round(exp), bio: String(req.body.bio || "").slice(0, 500), languages: langs.map((x) => String(x).trim().slice(0, 30)).filter(Boolean).slice(0, 8) }, { new: true });
  d ? res.json(d) : res.status(404).json({ error: "No doctor profile" });
});

r.get("/:id/slots", async (req, res) => {                  // free times for one doctor on one date
  const d = await Doctor.findById(req.params.id);
  if (!d) return res.status(404).json({ error: "Doctor not found" });
  const taken = (await Appointment.find({ doctor: d._id, date: req.query.date, status: "booked" }).select("time")).map((x) => x.time);
  res.json(freeSlots(availability(d), String(req.query.date), taken, nowIn()));
});

r.post("/", protect("admin"), async (req, res) => res.status(201).json(await Doctor.create(req.body)));
module.exports = r;
