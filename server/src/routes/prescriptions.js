const r = require("express").Router(), PDF = require("pdfkit");
const { Appointment, Doctor, Prescription, Reminder } = require("../models"), { notify } = require("../lib/notify"), { times } = require("../lib/dose"), { protect } = require("../auth"), canChat = require("../chatAccess");

r.post("/", protect("doctor"), async (req, res) => {
  const d = await Doctor.findOne({ user: req.user.id });
  const a = d && await Appointment.findOne({ _id: req.body.appointment, doctor: d._id, status: { $in: ["booked", "done"] } });
  if (!a) return res.status(404).json({ error: "Appointment not found" });
  const meds = (Array.isArray(req.body.medicines) ? req.body.medicines : [])
    .filter((m) => m && String(m.name || "").trim()).slice(0, 10)
    .map((m) => ({ name: String(m.name).trim().slice(0, 100), dose: String(m.dose || "").slice(0, 100), days: Math.min(365, Math.max(1, Number(m.days) || 1)) }));
  if (!meds.length) return res.status(400).json({ error: "Add at least one medicine" });
  const p = await Prescription.findOneAndUpdate({ appointment: a._id },
    { doctor: d._id, patient: a.patient, diagnosis: String(req.body.diagnosis || "").slice(0, 300), medicines: meds, notes: String(req.body.notes || "").slice(0, 500) },
    { upsert: true, new: true, setDefaultsOnInsert: true });
  notify(a.patient, "New prescription", `Dr. ${d.name.replace(/^Dr\.?\s*/i, "")} added a prescription for your visit on ${a.date}.`, "prescription");
  res.status(201).json(p);
});

// Patient's own prescriptions, newest first.
r.get("/mine", protect("patient"), async (req, res) =>
  res.json(await Prescription.find({ patient: req.user.id }).sort("-createdAt").populate("doctor", "name specialty").populate("appointment", "date time")));

// One tap: turn a prescription into daily medicine reminders. Safe to repeat; the same prescription never adds twice.
r.post("/:id/reminders", protect("patient"), async (req, res) => {
  const p = await Prescription.findOne({ _id: req.params.id, patient: req.user.id });
  if (!p) return res.status(404).json({ error: "Prescription not found" });
  if (await Reminder.exists({ prescription: p._id })) return res.json({ created: 0, message: "Reminders for this prescription already exist" });
  const docs = [];
  for (const m of p.medicines) for (const t of times(m.dose)) docs.push({ patient: req.user.id, medicine: m.name, time: t, prescription: p._id });
  await Reminder.insertMany(docs);
  res.status(201).json({ created: docs.length });
});

r.get("/:appointment/pdf", protect(), async (req, res) => {
  if (!(await canChat(req.user.id, req.params.appointment))) return res.status(403).json({ error: "Not allowed" });
  const p = await Prescription.findOne({ appointment: req.params.appointment }).populate("doctor patient", "name specialty");
  if (!p) return res.status(404).json({ error: "No prescription for this visit yet" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=prescription.pdf");
  const d = new PDF({ margin: 50 }); d.pipe(res);
  d.fontSize(24).text("MediSync").fontSize(11).fillColor("#555").text("Prescription").moveDown().fillColor("#000");
  d.fontSize(12).text("Doctor: " + p.doctor.name + " (" + p.doctor.specialty + ")").text("Patient: " + p.patient.name)
    .text("Date: " + p.updatedAt.toISOString().slice(0, 10)).moveDown();
  if (p.diagnosis) d.text("Diagnosis: " + p.diagnosis).moveDown();
  d.fontSize(14).text("Medicines").fontSize(12);
  p.medicines.forEach((m, i) => d.text(`${i + 1}. ${m.name}${m.dose ? " - " + m.dose : ""} - ${m.days} day(s)`));
  if (p.notes) d.moveDown().text("Notes: " + p.notes);
  d.moveDown(2).fontSize(9).fillColor("#777").text("Demo document made with MediSync. Follow your own doctor's advice.");
  d.end();
});
module.exports = r;
