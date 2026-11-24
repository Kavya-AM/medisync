require("dotenv").config();
const mongoose = require("mongoose"), bcrypt = require("bcryptjs");
const { User, Doctor } = require("./models");
const DOCS = [
  { name: "Dr. Ananya Rao", specialty: "Cardiologist", fee: 800, experience: 12, email: "ananya@medisync.com" },
  { name: "Dr. Kiran Shetty", specialty: "General physician", fee: 500, experience: 8, email: "kiran@medisync.com" },
  { name: "Dr. Meera Nair", specialty: "Dermatologist", fee: 600, experience: 10, email: "meera@medisync.com" },
  { name: "Dr. Ravi Kumar", specialty: "Orthopedic", fee: 700, experience: 15, email: "ravi@medisync.com" },
  { name: "Dr. Sneha Iyer", specialty: "Pediatrician", fee: 600, experience: 9, email: "sneha@medisync.com" },
];
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Doctor.deleteMany({}); await User.deleteMany({ role: { $in: ["doctor", "admin"] } });
  await User.create({ name: "Admin", email: "admin@medisync.com", password: await bcrypt.hash("Admin@123", 10), role: "admin" });
  for (const d of DOCS) {
    const u = await User.create({ name: d.name, email: d.email, password: await bcrypt.hash("Doctor@123", 10), role: "doctor" });
    await Doctor.create({ name: d.name, specialty: d.specialty, fee: d.fee, experience: d.experience, user: u._id });
  }
  console.log("Seeded. Admin: admin@medisync.com / Admin@123. Doctors: ananya@, kiran@, meera@, ravi@, sneha@medisync.com / Doctor@123");
  process.exit(0);
})();
