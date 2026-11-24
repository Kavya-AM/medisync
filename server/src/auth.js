const jwt = require("jsonwebtoken"), { User } = require("./models");
exports.sign = (u) => jwt.sign({ id: u._id, role: u.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
exports.protect = (...roles) => async (req, res, next) => {
  try {
    const t = (req.headers.authorization || "").replace("Bearer ", "");
    req.user = jwt.verify(t, process.env.JWT_SECRET);
    if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: "Not allowed" });
  } catch { return res.status(401).json({ error: "Please log in" }); }
  const u = await User.findById(req.user.id).select("active");           // deactivated or deleted accounts stop working at once
  if (!u || u.active === false) return res.status(401).json({ error: "This account is no longer active" });
  next();
};
