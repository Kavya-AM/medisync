const EMERGENCY = /chest pain|can.?t breathe|cannot breathe|unconscious|severe bleeding|stroke|seizure|fainted/;
const RULES = [
  [/heart|palpitation|breath/, "Cardiologist", "Heart and breathing symptoms need a specialist check."],
  [/skin|rash|itch|acne|hair|allergy/, "Dermatologist", "A skin specialist can check rashes, acne and hair problems."],
  [/bone|joint|knee|back pain|fracture|sprain/, "Orthopedic", "An orthopedic doctor can check bone and joint pain."],
  [/child|baby|infant|toddler/, "Pediatrician", "A pediatrician is the right doctor for children."],
  [/fever|cold|cough|throat|headache|body ache|tired|stomach|acid|vomit|digest|diarrh/, "General physician", "Start with a general physician for common illness."],
];
const SPECIALTIES = ["Cardiologist", "Dermatologist", "Orthopedic", "Pediatrician", "General physician"];
const ruleTriage = (text) => {
  const m = RULES.find((x) => x[0].test(text)) || [0, "General physician", "We could not match this, so start with a general physician."];
  return { specialty: m[1], advice: m[2] };
};
module.exports = { EMERGENCY, SPECIALTIES, ruleTriage };
