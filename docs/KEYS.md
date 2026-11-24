# Turning on the optional features

Every feature works in demo mode with no keys. Add keys to `server/.env` (or Render's environment tab), then restart the server.

| Feature | Keys | Without keys |
|---|---|---|
| AI symptom checker | `ANTHROPIC_API_KEY` from console.anthropic.com | Keyword rules. Emergency words are always checked by rules first. |
| Razorpay payments | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (Test mode keys, Razorpay dashboard > Settings > API keys) | Demo payment that marks the visit paid. |
| SMS for SOS | `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`. Twilio trial accounts can only text numbers you verified. | The message is printed in the server window only. |
| Password reset email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Gmail needs an app password) | The reset link is printed in the server window. |
| Mobile push | `FIREBASE_SERVICE_ACCOUNT`, see FIREBASE.md | No push. In-app reminder pop-ups still work. |
| Video | `JITSI_URL` (optional) | Public meet.jit.si. It may ask the first person to log in; self-host Jitsi to avoid that. |

Razorpay test card: 4111 1111 1111 1111, any future date, any CVV. Test UPI: success@razorpay.
