const test = require("node:test"), assert = require("node:assert"), crypto = require("crypto");
const { verifySignature } = require("../src/lib/pay");
const sig = (o, p, s) => crypto.createHmac("sha256", s).update(o + "|" + p).digest("hex");
test("accepts a correct signature", () => assert.ok(verifySignature("order_1", "pay_1", sig("order_1", "pay_1", "secret"), "secret")));
test("rejects a wrong signature", () => assert.ok(!verifySignature("order_1", "pay_1", "abc", "secret")));
test("rejects a signature for another payment", () => assert.ok(!verifySignature("order_1", "pay_2", sig("order_1", "pay_1", "secret"), "secret")));
test("rejects missing values", () => assert.ok(!verifySignature("", "pay_1", "x", "secret")));
