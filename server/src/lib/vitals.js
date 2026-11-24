// Health readings: sanity limits and a simple "usual range" label. General reference only, never a diagnosis.
const TYPES = {
  bp: { label: "Blood pressure", unit: "mmHg" }, sugar: { label: "Blood sugar", unit: "mg/dL" }, weight: { label: "Weight", unit: "kg" },
  heart: { label: "Heart rate", unit: "bpm" }, temp: { label: "Temperature", unit: "°C" }, spo2: { label: "Oxygen (SpO2)", unit: "%" },
};
const LIMITS = { bp: [50, 260], sugar: [20, 800], weight: [2, 400], heart: [20, 250], temp: [30, 45], spo2: [50, 100] };

// Returns an error message, or "" when the reading is acceptable.
function check(type, value, value2) {
  if (!TYPES[type]) return "Unknown reading type";
  if (typeof value !== "number" || !Number.isFinite(value)) return "Enter a number";
  const [lo, hi] = LIMITS[type];
  if (value < lo || value > hi) return `${TYPES[type].label} must be between ${lo} and ${hi} ${TYPES[type].unit}`;
  if (type === "bp") {
    if (typeof value2 !== "number" || !Number.isFinite(value2) || value2 < 30 || value2 > 160) return "Enter the lower (diastolic) number between 30 and 160";
    if (value2 >= value) return "The upper number must be higher than the lower number";
  }
  return "";
}

// "normal" | "low" | "high" | null (no range for this reading)
function classify(type, value, value2, context = "") {
  switch (type) {
    case "bp": return value >= 140 || value2 >= 90 ? "high" : value < 90 || value2 < 60 ? "low" : "normal";
    case "sugar": return value < 70 ? "low" : value >= (context === "after_meal" ? 140 : 100) ? "high" : "normal";
    case "heart": return value < 60 ? "low" : value > 100 ? "high" : "normal";
    case "temp": return value < 36.1 ? "low" : value >= 37.5 ? "high" : "normal";
    case "spo2": return value < 95 ? "low" : "normal";
    default: return null;
  }
}

const bmi = (kg, cm) => (kg > 0 && cm > 0 ? Math.round((kg / ((cm / 100) ** 2)) * 10) / 10 : null);
const bmiBand = (b) => (b == null ? null : b < 18.5 ? "under" : b < 25 ? "normal" : b < 30 ? "over" : "obese");

module.exports = { TYPES, LIMITS, check, classify, bmi, bmiBand };
