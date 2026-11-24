const test = require("node:test"), assert = require("node:assert");
const { check, classify, bmi, bmiBand } = require("../src/lib/vitals");
test("accepts a normal blood pressure", () => assert.equal(check("bp", 120, 80), ""));
test("blood pressure needs the lower number", () => assert.ok(check("bp", 120, undefined)));
test("upper number must be higher than lower", () => assert.ok(check("bp", 80, 90)));
test("rejects impossible values", () => { assert.ok(check("heart", 900)); assert.ok(check("temp", 12)); });
test("rejects unknown type and non numbers", () => { assert.ok(check("mood", 5)); assert.ok(check("weight", NaN)); });
test("bp bands", () => {
  assert.equal(classify("bp", 118, 76), "normal"); assert.equal(classify("bp", 150, 85), "high");
  assert.equal(classify("bp", 120, 95), "high"); assert.equal(classify("bp", 85, 55), "low");
});
test("sugar bands depend on fasting or after meal", () => {
  assert.equal(classify("sugar", 110, undefined, "fasting"), "high"); assert.equal(classify("sugar", 110, undefined, "after_meal"), "normal");
  assert.equal(classify("sugar", 60, undefined, "fasting"), "low");
});
test("heart, temperature and oxygen bands", () => {
  assert.equal(classify("heart", 72), "normal"); assert.equal(classify("heart", 120), "high"); assert.equal(classify("heart", 50), "low");
  assert.equal(classify("temp", 38.2), "high"); assert.equal(classify("temp", 36.8), "normal"); assert.equal(classify("spo2", 92), "low");
});
test("weight has no range", () => assert.equal(classify("weight", 70), null));
test("bmi and band", () => { assert.equal(bmi(70, 175), 22.9); assert.equal(bmiBand(22.9), "normal"); assert.equal(bmiBand(31), "obese"); assert.equal(bmi(0, 170), null); });
