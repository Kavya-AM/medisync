const r = require("express").Router();
const { Message } = require("../models"), { protect } = require("../auth"), canChat = require("../chatAccess");
r.get("/:room", protect(), async (req, res) => {
  if (!(await canChat(req.user.id, req.params.room))) return res.status(403).json({ error: "Not allowed" });
  res.json(await Message.find({ room: req.params.room }).sort("createdAt").limit(200));
});
module.exports = r;
