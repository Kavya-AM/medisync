const r = require("express").Router();
const { Device } = require("../models"), { protect } = require("../auth");
r.post("/", protect(), async (req, res) => {              // mobile app registers its push token here
  const token = String(req.body.token || "");
  if (token.length < 20) return res.status(400).json({ error: "Invalid token" });
  await Device.findOneAndUpdate({ token }, { user: req.user.id }, { upsert: true });
  res.json({ ok: true });
});
module.exports = r;
