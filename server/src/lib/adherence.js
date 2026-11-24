// Medicine "taken" history. dates = ["YYYY-MM-DD", ...]; today = "YYYY-MM-DD" in the clinic time zone.
const { shift } = require("./clock");
const day = (d, back) => shift({ date: d, time: "12:00" }, -1440 * back).date;

// Consecutive days taken, ending today (or yesterday if today is not taken yet).
function streak(dates = [], today) {
  const s = new Set(dates);
  let n = 0, back = s.has(today) ? 0 : 1;
  while (s.has(day(today, back))) { n++; back++; }
  return n;
}
// How many of the last 7 days (including today) were taken.
const week = (dates = [], today) => { const s = new Set(dates); let n = 0; for (let i = 0; i < 7; i++) if (s.has(day(today, i))) n++; return n; };

module.exports = { streak, week };
