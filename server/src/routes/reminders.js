const r = require("express").Router();
const { Reminder } = require("../models"), { protect } = require("../auth");
const { nowIn } = require("../lib/clock"), { streak, week } = require("../lib/adherence");
r.use(protect("patient"));

const out = (x, today) => ({ ...x.toObject(), takenToday: x.takenDates.includes(today), streak: streak(x.takenDates, today), week: week(x.takenDates, today) });

r.get("/", async (q, s) => { const { date } = nowIn(); s.json((await Reminder.find({ patient: q.user.id })).map((x) => out(x, date))); });

r.post("/", async (q, s) => {
  const medicine = String(q.body.medicine || "").trim().slice(0, 100), time = String(q.body.time || "");
  if (!medicine || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return s.status(400).json({ error: "Enter a medicine name and a time" });
  s.status(201).json(out(await Reminder.create({ patient: q.user.id, medicine, time }), nowIn().date));
});

r.patch("/:id", async (q, s) => {
  const x = await Reminder.findOneAndUpdate({ _id: q.params.id, patient: q.user.id }, { active: !!q.body.active }, { new: true });
  x ? s.json(out(x, nowIn().date)) : s.status(404).json({ error: "Not found" });
});

// Mark today's dose as taken (or undo). History feeds the streak and the 7-day count.
r.post("/:id/taken", async (q, s) => {
  const { date } = nowIn(), undo = q.body.taken === false;
  const x = await Reminder.findOneAndUpdate({ _id: q.params.id, patient: q.user.id }, undo ? { $pull: { takenDates: date } } : { $addToSet: { takenDates: date } }, { new: true });
  x ? s.json(out(x, date)) : s.status(404).json({ error: "Not found" });
});

r.delete("/:id", async (q, s) => { await Reminder.deleteOne({ _id: q.params.id, patient: q.user.id }); s.json({ ok: true }); });
module.exports = r;
