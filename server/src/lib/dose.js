// Turns the doctor's dose text into daily reminder times. Falls back to one morning dose.
const times = (dose = "") => {
  const t = String(dose).toLowerCase();
  if (/\b(1-1-1|tds|tid|thrice|three times|3 times|3x)\b/.test(t)) return ["08:00", "14:00", "21:00"];
  if (/\b(1-0-1|bd|bid|twice|two times|2 times|2x)\b/.test(t)) return ["08:00", "20:00"];
  if (/\b(0-0-1|night|bedtime|hs|evening)\b/.test(t)) return ["21:00"];
  return ["09:00"];
};
module.exports = { times };
