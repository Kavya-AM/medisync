# MediSync: Smart Healthcare Platform (MERN + Flutter)

Web app (React), mobile app (Flutter) and one shared REST API (Node.js, Express, MongoDB).

## Run it
1. Install Node 20+, MongoDB (or use Atlas) and, for the phone app, Flutter.
2. **API**
   ```
   cd server
   cp .env.example .env     (Windows: copy .env.example .env)
   npm install
   npm run seed
   npm run dev
   ```
   Check http://localhost:5000/api/health.
3. **Web:** `cd client && npm install && npm run dev`, then open http://localhost:5173
4. **Mobile:** `cd mobile && flutter create . && flutter pub get && flutter run` (see docs/FIREBASE.md for push)
5. **Tests:** `cd server && npm test`

Logins after `npm run seed`: admin@medisync.com / Admin@123. Doctors ananya@, kiran@, meera@, ravi@, sneha@medisync.com / Doctor@123. Patients register themselves.

## Features
**Patient:** book from the doctor's real free times, pay (Razorpay test mode) and download an invoice PDF, rate doctors, video call, chat, medicine reminders, health records with file upload, AI or keyword symptom checker, emergency SOS with SMS, prescription PDF.
**Doctor:** set working days, hours and slot length, dashboard, mark visits done, write prescriptions, video call, chat.
**Admin:** patients, doctors, appointments, revenue and a chart.
**New in this version**
- **Notifications:** a bell on web and mobile (live over Socket.IO, plus phone push). Booking, payment, prescription, reschedule, cancel and visit reminders (24 hours and 1 hour before).
- **Health readings:** blood pressure, sugar, weight, heart rate, temperature, oxygen, with charts, usual-range labels and BMI.
- **Profile and privacy:** health profile (blood group, allergies, conditions), change password, download all my data, delete my account, choose whether doctors can see your health profile.
- **Reschedule a visit** to another free time with the same doctor.
- **Medicine adherence:** mark doses taken, 7-day count and streaks. One tap turns a prescription into daily reminders.
- **Doctor:** "My patients" list with the health details each patient allows, and a public profile (fee, languages, bio).
- **Admin:** people list with search, add a doctor (temporary password), deactivate accounts, all visits with filters, CSV export.

**Everyone:** English, Kannada and Hindi, light and dark theme, larger text, password reset by email.

Optional keys (AI, Razorpay, Twilio, email, Firebase) are in docs/KEYS.md. With no keys every feature runs in demo mode.

## API
| Method | Route | Who |
|---|---|---|
| POST | /api/auth/register, /login, /forgot, /reset | public |
| GET | /api/doctors, /api/doctors/:id/slots?date= | public |
| GET/PUT | /api/doctors/me/availability | doctor |
| POST | /api/appointments | patient (409 if taken) |
| GET | /api/appointments/mine, /doctor | patient, doctor |
| PATCH | /api/appointments/:id/cancel, /done | patient, doctor |
| PATCH | /api/appointments/:id/reschedule | patient |
| GET | /api/appointments/:id/video | patient or doctor of it |
| POST | /api/payments/:id/order, /verify | patient |
| GET | /api/payments/:id/invoice | patient (PDF) |
| POST | /api/prescriptions | doctor |
| GET | /api/prescriptions/:appointment/pdf | patient or doctor of it |
| GET/POST/PATCH/DELETE | /api/reminders | patient |
| GET/POST | /api/records, GET /api/records/:id/file | patient |
| POST | /api/symptoms | logged in |
| POST/GET | /api/reviews, /api/reviews/:doctor | patient / public |
| PUT/POST | /api/sos/contact, /api/sos | patient |
| GET | /api/chat/:room | patient or doctor of it |
| POST | /api/devices | logged in (push token) |
| GET/PATCH/DELETE | /api/auth/me | logged in (profile; delete is patient only) |
| POST | /api/auth/change-password, GET /api/auth/export | logged in |
| GET/POST/DELETE, PATCH | /api/vitals, /api/vitals/summary | patient |
| GET, PATCH | /api/notifications, /read-all, /:id/read | logged in |
| GET | /api/patients, /api/patients/:id | doctor |
| GET/PUT | /api/doctors/me/profile | doctor |
| POST | /api/reminders/:id/taken | patient |
| GET | /api/prescriptions/mine, POST /api/prescriptions/:id/reminders | patient |
| GET/PATCH/POST | /api/admin/users, /users/:id/active, /doctors | admin |
| GET | /api/admin/stats, /appointments, /export/appointments.csv | admin |

Chat uses Socket.IO: `join` with an appointment id, then `chat`. The socket needs the same JWT and only the patient and doctor of that appointment can join.

## Security
bcrypt passwords, JWT with role checks, Helmet, rate limits (stricter on login), input validation, unique index against double booking, signed Razorpay payments, private files and video rooms, reset tokens stored as hashes.

## Put it online
See docs/DEPLOY.md.

## Still not included
Browser push when the page is closed, Cloudinary storage for uploaded files, iOS push setup, and a doctor-side mobile app.
