const test = require("node:test"), assert = require("node:assert");
const { streak, week } = require("../src/lib/adherence"), { toCsv } = require("../src/lib/csv"), { times } = require("../src/lib/dose");

test("streak counts consecutive days and tolerates today not yet taken", () => {
  assert.equal(streak(["2026-11-16", "2026-11-17", "2026-11-18"], "2026-11-18"), 3);
  assert.equal(streak(["2026-11-16", "2026-11-17"], "2026-11-18"), 2);
  assert.equal(streak(["2026-11-14"], "2026-11-18"), 0);
});
test("week counts taken days in the last seven", () => {
  assert.equal(week(["2026-11-18", "2026-11-12", "2026-11-11"], "2026-11-18"), 2);
});
test("csv neutralises spreadsheet formulas and quotes commas", () => {
  assert.match(toCsv(["a"], [["=SUM(1)"], ["x, y"]]), /'=SUM\(1\)/);
  assert.match(toCsv(["a"], [["x, y"]]), /"x, y"/);
});
test("dose text becomes reminder times", () => {
  assert.deepEqual(times("1-0-1 after food"), ["08:00", "20:00"]);
  assert.deepEqual(times("tds"), ["08:00", "14:00", "21:00"]);
  assert.deepEqual(times(""), ["09:00"]);
});
