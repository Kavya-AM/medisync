const { Notification } = require("../models"), { sendPush } = require("./push");
let io = null;
exports.setIo = (x) => { io = x; };

// Saves an in-app notification, pushes it live to open web pages, and sends a phone push when Firebase is set up.
// Never throws: a failed notification must not break the action that caused it.
exports.notify = async (user, title, body, kind = "info") => {
  if (!user) return null;
  try {
    const n = await Notification.create({ user, title, body, kind });
    if (io) io.to("user:" + user).emit("notification", n);
    sendPush(user, title, body).catch(() => {});
    return n;
  } catch (e) { console.error("notify failed:", e.message); return null; }
};
