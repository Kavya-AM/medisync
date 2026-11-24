const r = require("express").Router();
const { Vital, User } = require("../models"), { protect } = require("../auth");
const { TYPES, check, classify, bmi, bmiBand } = require("../lib/vitals");
r.use(protect("patient"));
const out = (v) => ({ ...(v.toObject ? v.toObject() : v), status: classify(v.type, v.value, v.value2, v.context) });

r.get("/", async (q, s) => {
  const f = { patient: q.user.id };
  if (q.query.type) { if (!TYPES[q.query.type]) return s.status(400).json({ error: "Unknown reading type" }); f.type = q.query.type; }
  s.json((await Vital.find(f).sort("-at").limit(200)).map(out));
});

// Newest reading of every type, plus BMI when height and weight are known.
r.get("/summary", async (q, s) => {
  const latest = {};
  for (const t of Object.keys(TYPES)) { const v = await Vital.findOne({ patient: q.user.id, type: t }).sort("-at"); if (v) latest[t] = out(v); }
  const u = await User.findById(q.user.id).select("heightCm");
  const b = latest.weight && u.heightCm ? bmi(latest.weight.value, u.heightCm) : null;
  s.json({ latest, bmi: b, bmiBand: bmiBand(b) });
});

r.post("/", async (q, s) => {
  const { type } = q.body, value = Number(q.body.value), value2 = q.body.value2 === "" || q.body.value2 == null ? undefined : Number(q.body.value2);
  const bad = check(type, value, type === "bp" ? value2 : undefined);
  if (bad) return s.status(400).json({ error: bad });
  let at = q.body.at ? new Date(q.body.at) : new Date();
  if (isNaN(at) || at.getTime() > Date.now() + 5 * 60000) return s.status(400).json({ error: "The time cannot be in the future" });
  const context = type === "sugar" && q.body.context === "after_meal" ? "after_meal" : type === "sugar" ? "fasting" : "";
  s.status(201).json(out(await Vital.create({
    patient: q.user.id, type, value, value2: type === "bp" ? value2 : undefined, context, note: String(q.body.note || "").slice(0, 120), at,
  })));
});

r.delete("/:id", async (q, s) => { await Vital.deleteOne({ _id: q.params.id, patient: q.user.id }); s.json({ ok: true }); });
module.exports = r;
