const r = require("express").Router();
const { Doctor } = require("../models"), { protect } = require("../auth");
const { EMERGENCY, SPECIALTIES, ruleTriage } = require("../lib/triage");

// Optional AI triage. Any problem (no key, network, bad answer) returns null and the keyword rules are used.
async function aiTriage(text) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "claude-sonnet-5-5", max_tokens: 300,
        system: "You help patients choose which kind of doctor to see. Never diagnose. Reply with JSON only, no other text: " +
          `{"specialty": one of ${JSON.stringify(SPECIALTIES)}, "advice": "one or two plain sentences"}`,
        messages: [{ role: "user", content: text }],
      }),
    });
    if (!r.ok) return null;
    const j = JSON.parse(((await r.json()).content?.[0]?.text || "").replace(/```json|```/g, "").trim());
    if (!SPECIALTIES.includes(j.specialty) || typeof j.advice !== "string") return null;
    return { specialty: j.specialty, advice: j.advice.slice(0, 300) };
  } catch { return null; }
}

r.post("/", protect(), async (req, res) => {
  const text = String(req.body.text || "").trim().slice(0, 500);
  if (text.length < 3) return res.status(400).json({ error: "Describe your symptoms first" });
  if (EMERGENCY.test(text.toLowerCase()))               // emergencies are always checked by rules first
    return res.json({ urgent: true, source: "rules", specialty: "Emergency care", advice: "These symptoms can be serious. Call 112 or go to the nearest hospital now.", doctors: [] });
  const ai = await aiTriage(text), m = ai || ruleTriage(text.toLowerCase());
  res.json({ urgent: false, source: ai ? "ai" : "rules", specialty: m.specialty, advice: m.advice + " This is guidance, not a diagnosis.",
    doctors: await Doctor.find({ specialty: new RegExp("^" + m.specialty, "i") }).limit(3) });
});
module.exports = r;
