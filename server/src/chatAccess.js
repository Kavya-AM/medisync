const { Appointment } = require("./models");
// Only the patient and the doctor of an appointment may use its chat room.
module.exports = async (userId, apptId) => {
  try {
    const a = await Appointment.findById(apptId).populate("doctor");
    return !!a && (String(a.patient) === String(userId) || String(a.doctor?.user) === String(userId));
  } catch { return false; }
};
