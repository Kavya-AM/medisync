const { Schema, model } = require("mongoose");
const ref = (m) => ({ type: Schema.Types.ObjectId, ref: m, required: true });

const User = model("User", new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["patient", "doctor", "admin"], default: "patient" },
  emergencyContact: { name: String, phone: String },
  phone: { type: String, maxlength: 20 }, dob: String, gender: { type: String, enum: ["", "female", "male", "other"], default: "" },
  bloodGroup: { type: String, enum: ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"], default: "" },
  heightCm: Number, allergies: { type: String, maxlength: 300 }, conditions: { type: String, maxlength: 300 },
  shareWithDoctors: { type: Boolean, default: true }, active: { type: Boolean, default: true },
  resetHash: String, resetExpires: Number,
}, { timestamps: true }));

const Doctor = model("Doctor", new Schema({
  name: String, specialty: String, fee: { type: Number, default: 500 }, experience: Number,
  user: { type: Schema.Types.ObjectId, ref: "User" },
  workDays: { type: [Number], default: [1, 2, 3, 4, 5, 6] },        // 0 = Sunday
  startTime: { type: String, default: "09:00" }, endTime: { type: String, default: "17:00" },
  slotMinutes: { type: Number, default: 30 },
  bio: { type: String, maxlength: 500, default: "" }, languages: { type: [String], default: [] },
}));

const apt = new Schema({
  patient: ref("User"), doctor: ref("Doctor"),
  date: { type: String, required: true }, time: { type: String, required: true },
  status: { type: String, enum: ["booked", "cancelled", "done"], default: "booked" },
  paid: { type: Boolean, default: false }, orderId: String, paymentId: String, invoiceNo: String,
  reminded24: { type: Boolean, default: false }, reminded1: { type: Boolean, default: false },
}, { timestamps: true });
apt.index({ doctor: 1, date: 1, time: 1 }, { unique: true, partialFilterExpression: { status: "booked" } });
const Appointment = model("Appointment", apt);

const Record = model("Record", new Schema({
  patient: ref("User"), title: String, type: { type: String, enum: ["Report", "Prescription"] },
  file: String, originalName: String,
}, { timestamps: true }));

const Reminder = model("Reminder", new Schema({
  patient: ref("User"), medicine: String, time: String, active: { type: Boolean, default: true },
  takenDates: { type: [String], default: [] },           // "YYYY-MM-DD" days the patient marked as taken
  prescription: { type: Schema.Types.ObjectId, ref: "Prescription" },
}));

const rev = new Schema({
  appointment: ref("Appointment"), doctor: ref("Doctor"), patient: ref("User"),
  stars: { type: Number, min: 1, max: 5, required: true }, comment: { type: String, maxlength: 300 },
}, { timestamps: true });
rev.index({ appointment: 1 }, { unique: true });
const Review = model("Review", rev);

const Message = model("Message", new Schema({
  room: { type: String, index: true }, sender: String, name: String, text: { type: String, maxlength: 500 },
}, { timestamps: true }));

const SosAlert = model("SosAlert", new Schema({
  patient: ref("User"), lat: Number, lng: Number, contactPhone: String, smsSent: Boolean,
}, { timestamps: true }));

const Prescription = model("Prescription", new Schema({
  appointment: { ...ref("Appointment"), unique: true }, doctor: ref("Doctor"), patient: ref("User"),
  diagnosis: { type: String, maxlength: 300 },
  medicines: [{ name: { type: String, maxlength: 100 }, dose: { type: String, maxlength: 100 }, days: Number }],
  notes: { type: String, maxlength: 500 },
}, { timestamps: true }));

const Device = model("Device", new Schema({ user: ref("User"), token: { type: String, required: true, unique: true } }));

const Notification = model("Notification", new Schema({
  user: ref("User"), title: String, body: String, kind: { type: String, default: "info" }, read: { type: Boolean, default: false },
}, { timestamps: true }));

const Vital = model("Vital", new Schema({
  patient: ref("User"), type: { type: String, enum: ["bp", "sugar", "weight", "heart", "temp", "spo2"], required: true },
  value: { type: Number, required: true }, value2: Number, context: String, note: { type: String, maxlength: 120 }, at: { type: Date, default: Date.now },
}, { timestamps: true }));
Vital.schema.index({ patient: 1, type: 1, at: -1 });

module.exports = { Notification, Vital, User, Doctor, Appointment, Record, Reminder, Review, Message, SosAlert, Prescription, Device };
