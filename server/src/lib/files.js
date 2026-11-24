const fs = require("fs"), path = require("path");
// Files are saved on the server disk. On hosts with temporary disks (Render free plan) switch this to Cloudinary or S3.
const DIR = path.resolve(process.env.UPLOAD_DIR || "uploads"); fs.mkdirSync(DIR, { recursive: true });
const remove = (name) => { if (name && /^[a-f0-9]{32}\.(pdf|png|jpg)$/.test(name)) fs.unlink(path.join(DIR, name), () => {}); };
module.exports = { DIR, remove };
