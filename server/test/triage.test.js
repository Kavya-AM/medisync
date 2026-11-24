const test = require("node:test"), assert = require("node:assert");
const { EMERGENCY, ruleTriage, SPECIALTIES } = require("../src/lib/triage");
test("chest pain is an emergency", () => assert.ok(EMERGENCY.test("i have chest pain")));
test("a cold is not an emergency", () => assert.ok(!EMERGENCY.test("runny nose and cough")));
test("rash goes to a dermatologist", () => assert.equal(ruleTriage("rash on my skin").specialty, "Dermatologist"));
test("knee pain goes to orthopedic", () => assert.equal(ruleTriage("my knee hurts").specialty, "Orthopedic"));
test("unknown text goes to a general physician", () => assert.equal(ruleTriage("feeling strange").specialty, "General physician"));
test("every suggested specialty is listed", () => ["heart", "rash", "knee", "baby", "fever"].forEach((w) => assert.ok(SPECIALTIES.includes(ruleTriage(w).specialty))));
