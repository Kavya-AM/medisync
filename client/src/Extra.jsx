import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { api, download, SOCKET_URL } from "./api";
import { notify } from "./alerts";
import { useT } from "./i18n";

const BAND = { normal: "In usual range", high: "Above usual range", low: "Below usual range" };
const Pill = ({ status }) => (status ? <span className={"pill " + (status === "normal" ? "ok" : "warn")}>{BAND[status]}</span> : null);
const when = (d) => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/* ---------- Notification bell (header) ---------- */
export function Bell() {
  const [n, setN] = useState({ items: [], unread: 0 }), [open, setOpen] = useState(false);
  const load = () => api("/notifications").then(setN).catch(() => {});
  useEffect(() => {
    load();
    const s = io(SOCKET_URL, { auth: { token: localStorage.token } });
    s.on("notification", (x) => {                      // arrives live while MediSync is open
      setN((p) => ({ items: [x, ...p.items].slice(0, 50), unread: p.unread + 1 }));
      notify(x.title + ": " + x.body, "MediSync");
    });
    const t = setInterval(load, 60000);
    return () => { s.disconnect(); clearInterval(t); };
  }, []);
  const readAll = () => api("/notifications/read-all", "PATCH").then(load);
  const clear = () => api("/notifications", "DELETE").then(load);
  const read = (x) => !x.read && api(`/notifications/${x._id}/read`, "PATCH").then(load);
  return (
    <div className="bellwrap">
      <button className="ghost" aria-label={`Notifications, ${n.unread} unread`} aria-expanded={open} onClick={() => setOpen(!open)}>
        🔔{n.unread > 0 && <span className="badge">{n.unread > 9 ? "9+" : n.unread}</span>}
      </button>
      {open && (
        <div className="panel card" role="dialog" aria-label="Notifications">
          <div className="row"><b>Notifications</b>
            <span><button className="ghost" onClick={readAll} disabled={!n.unread}>Mark all read</button><button className="ghost" onClick={clear} disabled={!n.items.length}>Clear</button></span></div>
          {n.items.length === 0 && <p><small>Nothing yet. Booking, payment and prescription updates show up here.</small></p>}
          {n.items.map((x) => (
            <div key={x._id} className={"note " + (x.read ? "" : "unread")} onClick={() => read(x)}>
              <b>{x.title}</b><br />{x.body}<br /><small>{when(x.createdAt)}</small>
            </div>))}
        </div>)}
    </div>
  );
}

/* ---------- Account: password, data export, delete ---------- */
function Account({ canDelete }) {
  const [f, setF] = useState({ current: "", password: "" }), [msg, setMsg] = useState(""), [pw, setPw] = useState("");
  const change = () => api("/auth/change-password", "POST", f).then(() => { setMsg("Password changed."); setF({ current: "", password: "" }); }).catch((e) => setMsg(e.message));
  const erase = () => {
    if (!window.confirm("Delete your account? Your records, readings and reminders are erased and future visits are cancelled. This cannot be undone.")) return;
    api("/auth/me", "DELETE", { password: pw }).then(() => { ["token", "name", "role"].forEach((k) => localStorage.removeItem(k)); window.location.reload(); }).catch((e) => setMsg(e.message));
  };
  return (
    <div className="card">
      <b>Account and privacy</b>
      <input aria-label="Current password" type="password" placeholder="Current password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      <input aria-label="New password" type="password" placeholder="New password (6+ characters)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      <button onClick={change}>Change password</button>
      <p><button className="ghost" onClick={() => download("/auth/export", "medisync-my-data.json").catch((e) => setMsg(e.message))}>Download my data</button></p>
      {canDelete && <details><summary>Delete my account</summary>
        <input aria-label="Password to confirm" type="password" placeholder="Enter your password to confirm" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="danger" disabled={!pw} onClick={erase}>Delete account</button></details>}
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}

/* ---------- Patient profile and health profile ---------- */
const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export function Profile() {
  const t = useT(), [u, setU] = useState(null), [msg, setMsg] = useState("");
  useEffect(() => { api("/auth/me").then(setU).catch((e) => setMsg(e.message)); }, []);
  if (!u) return msg ? <p className="err">{msg}</p> : null;
  const set = (k) => (e) => setU({ ...u, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const save = () => api("/auth/me", "PATCH", {
    name: u.name, phone: u.phone || "", dob: u.dob || "", gender: u.gender || "", bloodGroup: u.bloodGroup || "", heightCm: u.heightCm ?? "",
    allergies: u.allergies || "", conditions: u.conditions || "", shareWithDoctors: u.shareWithDoctors !== false,
  }).then((x) => { setU(x); localStorage.name = x.name; setMsg("Profile saved."); }).catch((e) => setMsg(e.message));
  return (
    <>
      <h2>{t("profile")}</h2>
      <div className="card">
        <label>Full name <input value={u.name || ""} onChange={set("name")} /></label>
        <small>{u.email}</small>
        <label>Phone <input inputMode="tel" value={u.phone || ""} onChange={set("phone")} /></label>
        <div className="row">
          <label>Date of birth <input type="date" max={new Date().toLocaleDateString("en-CA")} value={u.dob || ""} onChange={set("dob")} /></label>
          <label>Gender <select value={u.gender || ""} onChange={set("gender")}><option value="">Not said</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label>
          <label>Blood group <select value={u.bloodGroup || ""} onChange={set("bloodGroup")}>{BLOOD.map((b) => <option key={b} value={b}>{b || "Not known"}</option>)}</select></label>
          <label>Height (cm) <input type="number" min="50" max="250" value={u.heightCm ?? ""} onChange={set("heightCm")} /></label>
        </div>
        <label>Allergies <textarea rows="2" value={u.allergies || ""} onChange={set("allergies")} placeholder="Example: penicillin, peanuts" /></label>
        <label>Long-term conditions <textarea rows="2" value={u.conditions || ""} onChange={set("conditions")} placeholder="Example: asthma, diabetes" /></label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" style={{ width: "auto" }} checked={u.shareWithDoctors !== false} onChange={set("shareWithDoctors")} />
          Let doctors I have booked see this health profile and my readings
        </label>
        <button onClick={save}>Save profile</button>
        {msg && <p role="status">{msg}</p>}
      </div>
      <Account canDelete />
    </>
  );
}

export function DoctorProfile() {
  const t = useT(), [d, setD] = useState(null), [msg, setMsg] = useState("");
  useEffect(() => { api("/doctors/me/profile").then((x) => setD({ ...x, languages: (x.languages || []).join(", ") })).catch((e) => setMsg(e.message)); }, []);
  if (!d) return msg ? <p className="err">{msg}</p> : null;
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });
  const save = () => api("/doctors/me/profile", "PUT", { bio: d.bio, fee: Number(d.fee), experience: Number(d.experience), languages: d.languages.split(",").map((x) => x.trim()).filter(Boolean) })
    .then(() => setMsg("Profile saved. Patients see it when they pick you.")).catch((e) => setMsg(e.message));
  return (
    <>
      <h2>{t("profile")}</h2>
      <div className="card">
        <b>{d.name}</b> <small>{d.specialty}</small>
        <div className="row">
          <label>Consultation fee (₹) <input type="number" min="100" max="10000" value={d.fee} onChange={set("fee")} /></label>
          <label>Years of experience <input type="number" min="0" max="60" value={d.experience ?? 0} onChange={set("experience")} /></label>
        </div>
        <label>Languages you speak (comma separated) <input value={d.languages} onChange={set("languages")} placeholder="English, Kannada, Hindi" /></label>
        <label>About you <textarea rows="3" maxLength="500" value={d.bio} onChange={set("bio")} placeholder="A short introduction for patients" /></label>
        <button onClick={save}>Save profile</button>
        {msg && <p role="status">{msg}</p>}
      </div>
      <Account />
    </>
  );
}

/* ---------- Vitals tracker ---------- */
const VT = { bp: ["Blood pressure", "mmHg"], sugar: ["Blood sugar", "mg/dL"], weight: ["Weight", "kg"], heart: ["Heart rate", "bpm"], temp: ["Temperature", "°C"], spo2: ["Oxygen (SpO2)", "%"] };
const show = (v) => (v.type === "bp" ? `${v.value}/${v.value2}` : v.value) + " " + VT[v.type][1];

function Line({ rows, keys }) {                       // rows are oldest first
  if (rows.length < 2) return <p><small>Add at least two readings to see a chart.</small></p>;
  const W = 600, H = 160, P = 26, vals = rows.flatMap((r) => keys.map((k) => r[k])), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const x = (i) => P + (i * (W - 2 * P)) / (rows.length - 1), y = (v) => H - P - ((v - lo) / span) * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Readings over time" style={{ width: "100%", height: "auto" }}>
      {keys.map((k, j) => <polyline key={k} fill="none" stroke={j ? "var(--mut)" : "var(--mint)"} strokeWidth="3" strokeLinejoin="round" points={rows.map((r, i) => `${x(i)},${y(r[k])}`).join(" ")} />)}
      {rows.map((r, i) => <circle key={i} cx={x(i)} cy={y(r[keys[0]])} r="3.5" fill="var(--mint)" />)}
      <text x={4} y={16} fontSize="12" fill="var(--mut)">{hi}</text><text x={4} y={H - 8} fontSize="12" fill="var(--mut)">{lo}</text>
    </svg>
  );
}

export function Vitals() {
  const t = useT(), [type, setType] = useState("bp"), [rows, setRows] = useState([]), [sum, setSum] = useState(null), [msg, setMsg] = useState("");
  const [f, setF] = useState({ value: "", value2: "", context: "fasting", note: "" });
  const load = () => {
    api("/vitals?type=" + type).then(setRows).catch((e) => setMsg(e.message));
    api("/vitals/summary").then(setSum).catch(() => {});
  };
  useEffect(() => { load(); }, [type]);
  const add = () => api("/vitals", "POST", { type, value: f.value, value2: f.value2, context: f.context, note: f.note })
    .then(() => { setF({ ...f, value: "", value2: "", note: "" }); setMsg("Reading saved."); load(); }).catch((e) => setMsg(e.message));
  const del = (id) => api("/vitals/" + id, "DELETE").then(load);
  const chart = [...rows].slice(0, 30).reverse();
  return (
    <>
      <h2>{t("vitals")}</h2>
      <div className="grid">
        {Object.keys(VT).map((k) => {
          const v = sum?.latest?.[k];
          return (
            <button key={k} className={"card doc " + (type === k ? "on" : "")} aria-pressed={type === k} onClick={() => setType(k)}>
              <small>{VT[k][0]}</small><b style={{ fontSize: 22 }}>{v ? show(v) : "No reading"}</b><Pill status={v?.status} />
            </button>);
        })}
      </div>
      {sum?.bmi && <p>Body mass index: <b>{sum.bmi}</b> <small>({{ under: "below the usual range", normal: "in the usual range", over: "above the usual range", obese: "well above the usual range" }[sum.bmiBand]})</small></p>}
      <div className="card">
        <b>Add {VT[type][0].toLowerCase()}</b>
        <div className="row">
          <input aria-label={type === "bp" ? "Upper number" : "Value"} type="number" step="any" placeholder={type === "bp" ? "Upper (systolic)" : VT[type][1]} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          {type === "bp" && <input aria-label="Lower number" type="number" placeholder="Lower (diastolic)" value={f.value2} onChange={(e) => setF({ ...f, value2: e.target.value })} />}
          {type === "sugar" && <select aria-label="When" value={f.context} onChange={(e) => setF({ ...f, context: e.target.value })}><option value="fasting">Fasting</option><option value="after_meal">After a meal</option></select>}
        </div>
        <input aria-label="Note" placeholder="Note (optional)" maxLength="120" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <button onClick={add}>Save reading</button>
        {msg && <p role="status">{msg}</p>}
      </div>
      <div className="card">
        <b>{VT[type][0]} over time</b>
        <Line rows={chart} keys={type === "bp" ? ["value", "value2"] : ["value"]} />
        {type === "bp" && <small>Green line: upper number. Grey line: lower number.</small>}
        {rows.slice(0, 15).map((v) => (
          <div className="row" key={v._id}>
            <span><b>{show(v)}</b> <Pill status={v.status} /><br /><small>{when(v.at)}{v.context === "after_meal" ? " · after a meal" : v.context === "fasting" ? " · fasting" : ""}{v.note ? " · " + v.note : ""}</small></span>
            <button className="ghost" aria-label="Delete reading" onClick={() => del(v._id)}>Delete</button>
          </div>))}
        <p><small>Usual ranges are general guides, not a diagnosis. Talk to your doctor about readings that worry you.</small></p>
      </div>
    </>
  );
}

/* ---------- Doctor: my patients ---------- */
export function Patients() {
  const t = useT(), [list, setList] = useState([]), [p, setP] = useState(null), [msg, setMsg] = useState("");
  useEffect(() => { api("/patients").then(setList).catch((e) => setMsg(e.message)); }, []);
  const open = (id) => api("/patients/" + id).then(setP).catch((e) => setMsg(e.message));
  return (
    <>
      <h2>{t("patients")}</h2>
      {msg && <p className="err">{msg}</p>}
      {list.length === 0 && <p>Patients you have visits with will appear here.</p>}
      {list.map((x) => (
        <div className="card row" key={x._id}>
          <span><b>{x.name}</b><br /><small>{x.visits} visit(s) · last {x.lastVisit}{x.phone ? " · " + x.phone : ""}</small></span>
          <button className="ghost" onClick={() => open(x._id)}>Open summary</button>
        </div>))}
      {p && (
        <div className="card">
          <div className="row"><b>{p.name}</b><button className="ghost" onClick={() => setP(null)}>Close</button></div>
          {!p.shared ? <p><small>This patient has chosen not to share their health profile or readings.</small></p> : (
            <>
              <p><small>{[p.gender, p.dob && "born " + p.dob, p.bloodGroup && "blood group " + p.bloodGroup, p.heightCm && p.heightCm + " cm", p.bmi && "BMI " + p.bmi].filter(Boolean).join(" · ") || "No profile details added."}</small></p>
              {p.allergies && <p><b>Allergies:</b> {p.allergies}</p>}
              {p.conditions && <p><b>Conditions:</b> {p.conditions}</p>}
              {Object.keys(p.vitals || {}).length > 0 && <><b>Latest readings</b>
                {Object.entries(p.vitals).map(([k, v]) => <div className="row" key={k}><span>{VT[k][0]}: <b>{show(v)}</b> <Pill status={v.status} /></span><small>{when(v.at)}</small></div>)}</>}
            </>)}
          <b>Prescriptions from you</b>
          {p.prescriptions.length === 0 && <p><small>None yet.</small></p>}
          {p.prescriptions.map((rx) => (
            <p key={rx._id}><small>{rx.appointment?.date || rx.createdAt.slice(0, 10)}{rx.diagnosis ? " · " + rx.diagnosis : ""}</small><br />{rx.medicines.map((m) => `${m.name} (${m.dose || "as told"}, ${m.days}d)`).join("; ")}</p>))}
        </div>)}
    </>
  );
}

/* ---------- Admin: people and visits ---------- */
export function AdminUsers() {
  const t = useT(), [list, setList] = useState([]), [role, setRole] = useState(""), [q, setQ] = useState(""), [msg, setMsg] = useState(""), [made, setMade] = useState(null);
  const [d, setD] = useState({ name: "", email: "", specialty: "", fee: 500, experience: 5 });
  const load = () => api("/admin/users?" + new URLSearchParams({ role, q })).then(setList).catch((e) => setMsg(e.message));
  useEffect(() => { const id = setTimeout(load, 250); return () => clearTimeout(id); }, [role, q]);
  const toggle = (u) => api(`/admin/users/${u._id}/active`, "PATCH", { active: u.active === false }).then(load).catch((e) => setMsg(e.message));
  const addDoc = () => api("/admin/doctors", "POST", d).then((x) => { setMade(x); setMsg(""); setD({ name: "", email: "", specialty: "", fee: 500, experience: 5 }); load(); }).catch((e) => setMsg(e.message));
  return (
    <>
      <h2>{t("users")}</h2>
      <div className="card">
        <b>Add a doctor</b>
        <div className="row">
          <input aria-label="Doctor name" placeholder="Dr. Full Name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <input aria-label="Doctor email" type="email" placeholder="Email" value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} />
        </div>
        <div className="row">
          <input aria-label="Specialty" placeholder="Specialty, e.g. Cardiologist" value={d.specialty} onChange={(e) => setD({ ...d, specialty: e.target.value })} />
          <input aria-label="Fee" type="number" min="100" max="10000" value={d.fee} onChange={(e) => setD({ ...d, fee: e.target.value })} style={{ maxWidth: 110 }} />
          <input aria-label="Years of experience" type="number" min="0" max="60" value={d.experience} onChange={(e) => setD({ ...d, experience: e.target.value })} style={{ maxWidth: 90 }} />
        </div>
        <button onClick={addDoc}>Create doctor login</button>
        {made && <p role="status">Created {made.email}. Temporary password: <b>{made.tempPassword}</b>. Share it safely; it is shown only once.</p>}
      </div>
      <div className="row">
        <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} style={{ maxWidth: 160 }}><option value="">Everyone</option><option value="patient">Patients</option><option value="doctor">Doctors</option><option value="admin">Admins</option></select>
        <input aria-label="Search people" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {msg && <p className="err" role="alert">{msg}</p>}
      {list.map((u) => (
        <div className="card row" key={u._id}>
          <span><b>{u.name}</b> <small>{u.role}{u.active === false ? " · deactivated" : ""}</small><br /><small>{u.email} · joined {u.createdAt.slice(0, 10)}</small></span>
          <button className="ghost" onClick={() => toggle(u)}>{u.active === false ? "Activate" : "Deactivate"}</button>
        </div>))}
      {list.length === 0 && <p>No one found.</p>}
    </>
  );
}

export function AdminVisits() {
  const t = useT(), [list, setList] = useState([]), [status, setStatus] = useState(""), [date, setDate] = useState(""), [msg, setMsg] = useState("");
  useEffect(() => { api("/admin/appointments?" + new URLSearchParams({ status, date })).then(setList).catch((e) => setMsg(e.message)); }, [status, date]);
  return (
    <>
      <div className="row"><h2>{t("visits")}</h2>
        <button className="ghost" onClick={() => download("/admin/export/appointments.csv", "appointments.csv").catch((e) => setMsg(e.message))}>Export all as CSV</button></div>
      <div className="row">
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 160 }}><option value="">Any status</option><option value="booked">Booked</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select>
        <input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ maxWidth: 180 }} />
        {date && <button className="ghost" onClick={() => setDate("")}>Clear date</button>}
      </div>
      {msg && <p className="err">{msg}</p>}
      {list.length === 0 && <p>No visits match.</p>}
      {list.map((a) => (
        <div className="card row" key={a._id}>
          <span><b>{a.patient?.name || "Patient"}</b> with <b>{a.doctor?.name}</b><br /><small>{a.date} · {a.time} · {a.status}{a.paid ? " · paid ₹" + (a.doctor?.fee || 0) : ""}</small></span>
        </div>))}
    </>
  );
}
