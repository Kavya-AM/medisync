const r = require("express").Router();
const { Appointment, Review } = require("../models"), { protect } = require("../auth");
r.post("/", protect("patient"), async (req, res) => {
  const stars = Number(req.body.stars);
  if (!(stars >= 1 && stars <= 5)) return res.status(400).json({ error: "Choose 1 to 5 stars" });
  const a = await Appointment.findOne({ _id: req.body.appointment, patient: req.user.id, status: "done" });
  if (!a) return res.status(400).json({ error: "You can review only completed visits" });
  try {
    res.status(201).json(await Review.create({ appointment: a._id, doctor: a.doctor, patient: req.user.id, stars, comment: req.body.comment }));
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ error: "You already reviewed this visit" });
    throw e;
  }
});
r.get("/:doctor", async (req, res) => res.json(await Review.find({ doctor: req.params.doctor }).sort("-createdAt").limit(20)));
module.exports = r;
