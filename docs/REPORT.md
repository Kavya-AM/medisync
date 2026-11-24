# MediSync – Project Report (outline for 40 marks)

## 1. Problem statement (4)
Patients lose time on phone calls, paper records and missed medicines. Clinics double-book slots.

## 2. Objectives (4)
- Online booking with no double booking
- Digital records and medicine reminders
- One API for web and mobile
- Secure, role-based access

## 3. Literature / existing systems (3)
Practo, 1mg, Apollo 24/7. Gap: a simple, open, student-buildable platform that joins booking, records and reminders.

## 4. Proposed system and architecture (6)
React web + Flutter app → Express REST API (JWT) → MongoDB. Socket.IO for chat.

## 5. Modules (6)
Authentication with password reset, Doctor directory with ratings and availability, Appointments, Doctor dashboard, Prescriptions (PDF), Health records with file upload, Medicine reminders (web, mobile, push), AI symptom checker, Chat, Video consultation, Emergency SOS with SMS, Razorpay payments with invoice PDF, Admin analytics, three languages.

## 6. Database design (4)
Users, Doctors, Appointments (unique doctor+date+time for booked slots), Records, Reminders, Reviews, Messages, SosAlerts.

## 7. Implementation (5)
Tools: VS Code, Postman, MongoDB Compass, Docker. Key code: slot uniqueness index, JWT middleware.

## 8. Testing (4)
| Test | Expected | Result |
|---|---|---|
| Register with short password | 400 error | Pass |
| Book same slot twice | 409 error | Pass |
| Patient calls admin route | 403 | Pass |
| Cancel another user's visit | 404 | Pass |
| Rate a visit that is not done | 400 | Pass |
| Open chat of another appointment | 403 / join refused | Pass |
| Symptom text with chest pain | Urgent: call 112 | Pass |
| Send SOS with no contact saved | 400 | Pass |
| Book a time outside the doctor's hours | 400 | Pass |
| Verify payment with a wrong signature | 400 | Pass |
| Download another patient's file | 404 | Pass |
| Run `npm test` (18 unit tests: slots, triage, payment signature) | All pass | Pass |

## 9. Conclusion and future scope (4)
AI triage, live payments, video consults, wearable data.

## Likely viva questions
- Why MongoDB? Flexible documents for records, easy scaling.
- How do you stop double booking? A unique compound index plus a 409 response.
- How is data protected? Hashed passwords, JWT, role checks, HTTPS in production.
- Why one API for web and mobile? One source of truth, less code.

- How is chat secured? The socket needs a valid JWT and the server checks the user belongs to that appointment before joining the room.
- Why a partial unique index? Only booked slots block others, so a cancelled slot can be booked again.

- How do payments stay safe? The server creates the order, and after payment it checks Razorpay's signature (HMAC-SHA256) before marking the visit paid.
- What if the AI is down? The server falls back to keyword rules, and emergency words are always checked by rules first.
- How are slots made? From each doctor's working days, hours and slot length, minus booked times and past times.
