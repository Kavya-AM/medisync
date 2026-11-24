module.exports = async (to, body) => {
  const { TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) { console.log("[SMS demo] to", to, body); return { sent: false, demo: true }; }
  const num = to.startsWith("+") ? to : "+91" + to.replace(/\D/g, "").slice(-10);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(TWILIO_SID + ":" + TWILIO_TOKEN).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: num, From: TWILIO_FROM, Body: body }),
  });
  if (!r.ok) console.error("Twilio error", r.status);
  return { sent: r.ok, demo: false };
};
