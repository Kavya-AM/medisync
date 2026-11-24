const test = require("node:test"), assert = require("node:assert");
const { allSlots, freeSlots, workingDay, availability } = require("../src/lib/slots");
const av = availability({ workDays: [1, 2, 3, 4, 5, 6], startTime: "09:00", endTime: "10:30", slotMinutes: 30 });

test("builds slots inside working hours", () => assert.deepEqual(allSlots(av), ["09:00", "09:30", "10:00"]));
test("Sunday is a day off", () => assert.equal(workingDay(av, "2026-11-22"), false));
test("Tuesday is a working day", () => assert.equal(workingDay(av, "2026-11-17"), true));
test("removes booked slots", () => assert.deepEqual(freeSlots(av, "2026-11-18", ["09:30"]), ["09:00", "10:00"]));
test("no slots on a past date", () => assert.deepEqual(freeSlots(av, "2026-11-10", [], { date: "2026-11-17", time: "08:00" }), []));
test("today hides times that have passed", () => assert.deepEqual(freeSlots(av, "2026-11-17", [], { date: "2026-11-17", time: "09:10" }), ["09:30", "10:00"]));
test("rejects a badly formatted date", () => assert.deepEqual(freeSlots(av, "tomorrow", []), []));
test("old doctor records get default hours", () => assert.equal(availability({}).startTime, "09:00"));
