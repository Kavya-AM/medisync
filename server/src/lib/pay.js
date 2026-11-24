const crypto = require("crypto");
// Razorpay signs "order_id|payment_id" with your key secret.
exports.verifySignature = (orderId, paymentId, signature, secret) => {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const good = crypto.createHmac("sha256", secret).update(orderId + "|" + paymentId).digest("hex");
  const a = Buffer.from(good), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
