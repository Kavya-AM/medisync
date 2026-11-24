import { useEffect, useState } from "react";
import { api, openVideo } from "./api";
import { useT } from "./i18n";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function Availability() {
  const [av, setAv] = useState(null), [msg, setMsg] = useState("");
  useEffect(() => { api("/doctors/me/availability").then(setAv).catch((e) => setMsg(e.message)); }, []);
  if (!av) return msg ? <p className="err">{msg}</p> : null;
  const toggle = (d) => setAv({ ...av, workDays: av.workDays.includes(d) ? av.workDays.filter((x) => x !== d) : [...av.workDays, d].sort() });
  const save = () => api("/doctors/me/availability", "PUT", av).then(() => setMsg("Availability saved")).catch((e) => setMsg(e.message));
  return (
    <div className="card">
      <b>My working hours</b>
      <div className="slots">{DAYS.map((n, d) => <button key={n} className={av.workDays.includes(d) ? "on" : ""} aria-pressed={av.workDays.includes(d)} onClick={() => toggle(d)}>{n}</button>)}</div>
      <div className="row">
        <label>From <input type="time" value={av.startTime} onChange={(e) => setAv({ ...av, startTime: e.target.value })} /></label>
        <label>To <input type="time" value={av.endTime} onChange={(e) => setAv({ ...av, endTime: e.target.value })} /></label>
        <label>Slot <select value={av.slotMinutes} onChange={(e) => setAv({ ...av, slotMinutes: +e.target.value })}>
          {[15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} min</option>)}</select></label>
      </div>
      <button onClick={save}>Save hours</button>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}

function Rx({ a, onClose }) {
  const [dx, setDx] = useState(""), [notes, setNotes] = useState(""), [meds, setMeds] = useState([{ name: "", dose: "", days: 5 }]), [msg, setMsg] = useState("");
  const set = (i, k, v) => setMeds(meds.map((m, j) => j === i ? { ...m, [k]: v } : m));
  const save = () => api("/prescriptions", "POST", { appointment: a._id, diagnosis: dx, notes, medicines: meds })
    .then(() => { setMsg("Prescription saved. The patient can download it."); setTimeout(onClose, 1200); }).catch((e) => setMsg(e.message));
  return (
    <div className="card">
      <b>Prescription for {a.patient?.name}</b>
      <input aria-label="Diagnosis" placeholder="Diagnosis (optional)" value={dx} onChange={(e) => setDx(e.target.value)} />
      {meds.map((m, i) => (
        <div className="row" key={i}>
          <input aria-label="Medicine" placeholder="Medicine" value={m.name} onChange={(e) => set(i, "name", e.target.value)} />
          <input aria-label="Dose" placeholder="Dose, e.g. 1 tablet twice a day" value={m.dose} onChange={(e) => set(i, "dose", e.target.value)} />
          <input aria-label="Days" type="number" min="1" style={{ maxWidth: 80 }} value={m.days} onChange={(e) => set(i, "days", e.target.value)} />
        </div>))}
      {meds.length < 10 && <button className="ghost" onClick={() => setMeds([...meds, { name: "", dose: "", days: 5 }])}>Add medicine</button>}
      <textarea aria-label="Notes" rows="2" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <button onClick={save}>Save prescription</button> <button className="ghost" onClick={onClose}>Close</button>
      {msg && <p role="status">{msg}</p>}
    </div>
  );
}

export function DoctorDash() {
  const t = useT();
  const [list, setList] = useState([]), [rx, setRx] = useState(null), [msg, setMsg] = useState("");
  const load = () => api("/appointments/doctor").then(setList);
  useEffect(() => { load(); }, []);
  return (
    <>
      <h2>{t("appointments")}</h2>
      <Availability />
      {msg && <p className="err">{msg}</p>}
      {list.length === 0 && <p>No appointments yet.</p>}
      {list.map((a) => (
        <div key={a._id}>
          <div className="card row">
            <span><b>{a.patient?.name}</b><br /><small>{a.date} · {a.time} · {a.status}{a.paid ? " · paid" : ""}</small></span>
            <span className="acts">
              {a.status !== "cancelled" && <button className="ghost" onClick={() => openVideo(a._id, setMsg)}>Video call</button>}
              {a.status !== "cancelled" && <button className="ghost" onClick={() => setRx(rx === a._id ? null : a._id)}>Prescription</button>}
              {a.status === "booked" && <button onClick={() => api(`/appointments/${a._id}/done`, "PATCH").then(load)}>Mark done</button>}
            </span>
          </div>
          {rx === a._id && <Rx a={a} onClose={() => setRx(null)} />}
        </div>))}
    </>
  );
}

export function Admin() {
  const t = useT();
  const [s, setS] = useState(null);
  useEffect(() => { api("/admin/stats").then(setS); }, []);
  if (!s) return <p>Loading…</p>;
  const mx = Math.max(1, ...Object.values(s.byDoctor));
  return (
    <>
      <h2>{t("insights")}</h2>
      <div className="grid">
        {[["Patients", s.patients], ["Doctors", s.doctors], ["Appointments", s.appointments], ["Cancelled", s.cancelled], ["Revenue", "₹" + s.revenue]]
          .map(([k, v]) => <div className="card" key={k}><b style={{ fontSize: 28 }}>{v}</b><br /><small>{k}</small></div>)}
      </div>
      <div className="card"><b>Appointments by doctor</b>
        {Object.entries(s.byDoctor).map(([n, v]) => (
          <div key={n} style={{ margin: "8px 0" }}><small>{n} · {v}</small><div className="bar" style={{ width: (v / mx) * 100 + "%" }} /></div>))}
      </div>
    </>
  );
}
