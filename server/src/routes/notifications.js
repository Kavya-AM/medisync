const r = require("express").Router();
const { Notification } = require("../models"), { protect } = require("../auth");
r.use(protect());
r.get("/", async (q, s) => {
  const [items, unread] = await Promise.all([
    Notification.find({ user: q.user.id }).sort("-createdAt").limit(50), Notification.countDocuments({ user: q.user.id, read: false })]);
  s.json({ items, unread });
});
r.patch("/read-all", async (q, s) => { await Notification.updateMany({ user: q.user.id, read: false }, { read: true }); s.json({ ok: true }); });
r.patch("/:id/read", async (q, s) => { await Notification.updateOne({ _id: q.params.id, user: q.user.id }, { read: true }); s.json({ ok: true }); });
r.delete("/", async (q, s) => { await Notification.deleteMany({ user: q.user.id }); s.json({ ok: true }); });
module.exports = r;
