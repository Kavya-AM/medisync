// Doctors see only the patients they have a visit with, and only the health details the patient allows.
const r = require("express").Router();
const { Doctor, Appointment, Prescription, Vital, User } = require("../models"), { protect } = require("../auth");
const { TYPES, classify, bmi, bmiBand } = require("../lib/vitals");
r.use(protect("doctor"));

r.get("/", async (q, s) => {
  const d = await Doctor.findOne({ user: q.user.id });
  if (!d) return s.json([]);
  const apts = await Appointment.find({ doctor: d._id, status: { $ne: "cancelled" } }).populate("patient", "name email phone").sort("-date -time").lean();
  const m = new Map();
  for (const a of apts) {
    if (!a.patient) continue;
    const k = String(a.patient._id), e = m.get(k) || { _id: a.patient._id, name: a.patient.name, email: a.patient.email, phone: a.patient.phone, visits: 0, lastVisit: a.date };
    e.visits++; m.set(k, e);
  }
  s.json([...m.values()]);
});

r.get("/:id", async (q, s) => {
  const d = await Doctor.findOne({ user: q.user.id });
  const has = d && await Appointment.exists({ doctor: d._id, patient: q.params.id, status: { $ne: "cancelled" } }).catch(() => null);
  if (!has) return s.status(404).json({ error: "Patient not found" });
  const u = await User.findById(q.params.id).select("name email phone dob gender bloodGroup heightCm allergies conditions shareWithDoctors");
  const out = { id: u._id, name: u.name, email: u.email, phone: u.phone, shared: u.shareWithDoctors !== false };
  out.prescriptions = await Prescription.find({ patient: u._id, doctor: d._id }).sort("-createdAt").limit(10).populate("appointment", "date time");
  if (out.shared) {
    Object.assign(out, { dob: u.dob, gender: u.gender, bloodGroup: u.bloodGroup, heightCm: u.heightCm, allergies: u.allergies, conditions: u.conditions });
    out.vitals = {};
    for (const t of Object.keys(TYPES)) {
      const v = await Vital.findOne({ patient: u._id, type: t }).sort("-at").lean();
      if (v) out.vitals[t] = { ...v, status: classify(v.type, v.value, v.value2, v.context) };
    }
    const b = out.vitals.weight && u.heightCm ? bmi(out.vitals.weight.value, u.heightCm) : null;
    out.bmi = b; out.bmiBand = bmiBand(b);
  }
  s.json(out);
});
module.exports = r;
