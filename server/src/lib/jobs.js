const { Appointment } = require("../models"), { nowIn, shift } = require("./clock"), { notify } = require("./notify");
const key = (a) => a.date + " " + a.time, stamp = (x) => x.date + " " + x.time;

// Every minute: tell patient and doctor about visits that are about 24 hours or 1 hour away. Flags are claimed atomically,
// so a restart or a second server never sends the same reminder twice.
async function remindVisits() {
  const now = nowIn(), t60 = shift(now, 60), t24 = shift(now, 1440);
  const cands = await Appointment.find({ status: "booked", reminded24: false, date: { $gte: now.date, $lte: t24.date } }).populate("doctor", "name user");
  for (const a of cands) {
    const k = key(a);
    const soon = k > stamp(now) && k <= stamp(t60), tomorrow = k > stamp(t60) && k <= stamp(t24);
    if (!soon && !tomorrow) continue;
    const claim = soon ? { reminded1: true, reminded24: true } : { reminded24: true };
    const got = await Appointment.updateOne({ _id: a._id, reminded24: false, status: "booked" }, claim);
    if (!got.modifiedCount) continue;
    const when = `${a.date} at ${a.time}`;
    await notify(a.patient, soon ? "Visit starting soon" : "Visit tomorrow", `Your visit with ${a.doctor?.name || "your doctor"} is on ${when}.`, "reminder");
    await notify(a.doctor?.user, soon ? "Visit starting soon" : "Visit tomorrow", `You have a visit on ${when}.`, "reminder");
  }
  // Second pass: visits booked for tomorrow that already got the 24h reminder still need the 1 hour one.
  const near = await Appointment.find({ status: "booked", reminded24: true, reminded1: false, date: { $gte: now.date, $lte: t60.date } }).populate("doctor", "name user");
  for (const a of near) {
    const k = key(a);
    if (!(k > stamp(now) && k <= stamp(t60))) continue;
    const got = await Appointment.updateOne({ _id: a._id, reminded1: false, status: "booked" }, { reminded1: true });
    if (!got.modifiedCount) continue;
    const when = `${a.date} at ${a.time}`;
    await notify(a.patient, "Visit starting soon", `Your visit with ${a.doctor?.name || "your doctor"} is on ${when}.`, "reminder");
    await notify(a.doctor?.user, "Visit starting soon", `You have a visit on ${when}.`, "reminder");
  }
}

exports.startJobs = () => {
  setInterval(() => remindVisits().catch((e) => console.error("visit reminders:", e.message)), 60000);
  console.log("Visit reminders on");
};
exports.remindVisits = remindVisits;
