const r = require("express").Router(), multer = require("multer"), crypto = require("crypto"), fs = require("fs"), path = require("path");
const { Record } = require("../models"), { protect } = require("../auth");
// Files are saved on the server disk. On hosts with temporary disks (Render free plan) switch this to Cloudinary or S3.
const DIR = path.resolve(process.env.UPLOAD_DIR || "uploads"); fs.mkdirSync(DIR, { recursive: true });
const EXT = { "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg" };
const upload = multer({
  storage: multer.diskStorage({ destination: DIR, filename: (_q, f, cb) => cb(null, crypto.randomBytes(16).toString("hex") + EXT[f.mimetype]) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_q, f, cb) => EXT[f.mimetype] ? cb(null, true) : cb(Object.assign(new Error("Only PDF, PNG or JPG files are allowed"), { status: 400 })),
});
r.use(protect("patient"));
r.get("/", async (q, s) => s.json(await Record.find({ patient: q.user.id }).sort("-createdAt")));
r.post("/", upload.single("file"), async (q, s) => {
  const title = String(q.body.title || "").trim().slice(0, 120);
  if (!title) { if (q.file) fs.unlink(q.file.path, () => {}); return s.status(400).json({ error: "Enter a record name" }); }
  s.status(201).json(await Record.create({
    patient: q.user.id, title, type: q.body.type === "Prescription" ? "Prescription" : "Report",
    file: q.file?.filename, originalName: q.file?.originalname?.slice(0, 120),
  }));
});
r.get("/:id/file", async (q, s) => {
  const rec = await Record.findOne({ _id: q.params.id, patient: q.user.id });
  if (!rec?.file) return s.status(404).json({ error: "No file attached" });
  s.sendFile(rec.file, { root: DIR });
});
module.exports = r;
