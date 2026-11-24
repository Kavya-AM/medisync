const { Device, Reminder } = require("../models"), { nowIn } = require("./clock");
let admin = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const a = require("firebase-admin");
    a.initializeApp({ credential: a.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    admin = a;
  }
} catch (e) { console.log("Push disabled:", e.message); }

const sendPush = async (userId, title, body) => {
  if (!admin) return;
  const ds = await Device.find({ user: userId });
  if (!ds.length) return;
  const res = await admin.messaging().sendEachForMulticast({ tokens: ds.map((d) => d.token), notification: { title, body } });
  res.responses.forEach((x, i) => {                 // remove tokens that no longer exist
    if (!x.success && /not-registered|invalid-registration/.test(x.error?.code || "")) Device.deleteOne({ token: ds[i].token }).catch(() => {});
  });
};
// Every 30 seconds: push the reminders that are due this minute (once each).
const startReminderPush = () => {
  if (!admin) return console.log("Push reminders off (no FIREBASE_SERVICE_ACCOUNT)");
  const sent = new Set();
  setInterval(async () => {
    try {
      const { date, time } = nowIn();
      for (const r of await Reminder.find({ active: true, time })) {
        const k = r._id + date + time;
        if (sent.has(k)) continue;
        sent.add(k);
        sendPush(r.patient, "Medicine time", "Take " + r.medicine + " now.").catch(() => {});
      }
      if (sent.size > 5000) sent.clear();
    } catch (e) { console.error("push loop", e.message); }
  }, 30000);
  console.log("Push reminders on");
};
module.exports = { sendPush, startReminderPush };
