const toMin = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const fmt = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
const DEFAULT = { workDays: [1, 2, 3, 4, 5, 6], startTime: "09:00", endTime: "17:00", slotMinutes: 30 };
const availability = (d = {}) => ({
  workDays: d.workDays && d.workDays.length ? d.workDays : DEFAULT.workDays,
  startTime: d.startTime || DEFAULT.startTime, endTime: d.endTime || DEFAULT.endTime, slotMinutes: d.slotMinutes || DEFAULT.slotMinutes,
});
function allSlots(av) {
  const out = [];
  for (let m = toMin(av.startTime); m + av.slotMinutes <= toMin(av.endTime); m += av.slotMinutes) out.push(fmt(m));
  return out;
}
const workingDay = (av, date) => av.workDays.includes(new Date(date + "T00:00:00Z").getUTCDay());
// now = { date: "YYYY-MM-DD", time: "HH:MM" } in the clinic's time zone
function freeSlots(av, date, taken = [], now) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !workingDay(av, date)) return [];
  if (now && date < now.date) return [];
  let s = allSlots(av).filter((t) => !taken.includes(t));
  if (now && date === now.date) s = s.filter((t) => t > now.time);
  return s;
}
module.exports = { toMin, fmt, availability, allSlots, workingDay, freeSlots };
