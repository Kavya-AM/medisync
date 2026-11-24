const test = require("node:test"), assert = require("node:assert");
const { times } = require("../src/lib/dose");
test("twice a day", () => { assert.deepEqual(times("1 tablet twice a day"), ["08:00", "20:00"]); assert.deepEqual(times("1-0-1"), ["08:00", "20:00"]); });
test("three times a day", () => { assert.deepEqual(times("3 times daily"), ["08:00", "14:00", "21:00"]); assert.deepEqual(times("TDS"), ["08:00", "14:00", "21:00"]); });
test("night dose", () => assert.deepEqual(times("1 tablet at bedtime"), ["21:00"]));
test("unknown or empty text gets one morning dose", () => { assert.deepEqual(times(""), ["09:00"]); assert.deepEqual(times("take two tablets once"), ["09:00"]); assert.deepEqual(times(undefined), ["09:00"]); });
