exports.nowIn = (tz = process.env.CLINIC_TZ || "Asia/Kolkata") => {
  const d = new Date();
  return {
    date: d.toLocaleDateString("en-CA", { timeZone: tz }),
    time: d.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }),
  };
};

// Moves a { date: "YYYY-MM-DD", time: "HH:MM" } clock reading by a number of minutes (negative = earlier).
// Plain calendar arithmetic in UTC, so it never depends on the server's own time zone or daylight saving.
exports.shift = ({ date, time }, minutes) => {
  const d = new Date(`${date}T${time}:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
};
