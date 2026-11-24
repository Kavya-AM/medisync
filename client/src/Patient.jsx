import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, download, openVideo, SOCKET_URL } from "./api";
import { beep, canNotify, notify } from "./alerts";
import { useT } from "./i18n";

const today = () => new Date().toLocaleDateString("en-CA");
const loadRazorpay = () => new Promise((ok, no) => {
  if (window.Razorpay) return ok();
  const s = document.createElement("script");
  s.src = "https://checkout.razorpay.com/v1/checkout.js"; s.onload = ok; s.onerror = () => no(new Error("Could not load Razorpay"));
  document.body.appendChild(s);
});

async function pay(a, reload, setMsg) {
  try {
    const o = await api(`/payments/${a._id}/order`, "POST");
    if (o.demo) { await api(`/payments/${a._id}/verify`, "POST", {}); setMsg("Demo payment done. Add Razorpay test keys on the server for real checkout."); return reload(); }
    await loadRazorpay();
    new window.Razorpay({
      key: o.keyId, amount: o.amount, currency: "INR", name: "MediSync", description: "Consultation fee", order_id: o.orderId,
      handler: async (r) => {
        try { await api(`/payments/${a._id}/verify`, "POST", { paymentId: r.razorpay_payment_id, signature: r.razorpay_signature }); setMsg("Payment successful"); reload(); }
        catch (e) { setMsg(e.message); }
      },
    }).open();
  } catch (e) { setMsg(e.message); }
}

function Rate({ a }) {
  const [s, setS] = useState(5), [msg, setMsg] = useState("");
  const go = () => api("/reviews", "POST", { appointment: a._id, stars: s }).then(() => setMsg("Thanks for rating")).catch((e) => setMsg(e.message));
  return msg ? <small>{msg}</small> : (
    <span><select aria-label="Stars" value={s} onChange={(e) => setS(+e.target.value)}>{[5, 4, 3, 2, 1].map((n) => <option key={n}>{n}</option>)}</select>
      <button onClick={go}>Rate</button></span>
  );
}

export function Book() {
  const t = useT();
  const [docs, setDocs] = useState([]), [doc, setDoc] = useState(null), [date, setDate] = useState(today());
  const [slots, setSlots] = useState(null), [time, setTime] = useState(""), [mine, setMine] = useState([]), [msg, setMsg] = useState("");
  const load = () => api("/appointments/mine").then(setMine);
  useEffect(() => { api("/doctors").then(setDocs); load(); }, []);
  useEffect(() => {
    setTime("");
    if (doc) api(`/doctors/${doc._id}/slots?date=${date}`).then(setSlots).catch(() => setSlots([])); else setSlots(null);
  }, [doc, date, mine]);
  const book = async () => {
    try { await api("/appointments", "POST", { doctor: doc._id, date, time }); setMsg("Appointment booked"); load(); }
    catch (e) { setMsg(e.message); }
  };
  return (
    <>
      <h2>{t("book")}</h2>
      <div className="grid">{docs.map((d) => (
        <button key={d._id} className={"card doc " + (doc?._id === d._id ? "on" : "")} aria-pressed={doc?._id === d._id} onClick={() => setDoc(d)}>
          <b>{d.name}</b><small>{d.specialty} · ₹{d.fee}</small>
          <small>{d.rating ? `★ ${d.rating} (${d.reviews})` : "No ratings yet"}</small>
        </button>))}</div>
      {doc && <div className="card">
        <label>Date <input type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {slots && slots.length === 0 && <p>No free times on this day. Try another date.</p>}
        <div className="slots">{(slots || []).map((s) => (
          <button key={s} className={time === s ? "on" : ""} aria-pressed={time === s} onClick={() => setTime(s)}>{s}</button>))}</div>
        <button disabled={!time} onClick={book}>{t("confirm")}</button>
      </div>}
      {msg && <p role="status">{msg}</p>}
      <h2>{t("myVisits")}</h2>
      {mine.length === 0 && <p>No visits yet. Book one above.</p>}
      {mine.map((a) => (
        <div className="card row" key={a._id}>
          <span><b>{a.doctor?.name}</b><br /><small>{a.date} · {a.time} · {a.status}{a.paid ? " · paid" : ""}</small></span>
          <span className="acts">
            {a.status === "booked" && !a.paid && <button onClick={() => pay(a, load, setMsg)}>{t("pay")}</button>}
            {a.paid && <button className="ghost" onClick={() => download(`/payments/${a._id}/invoice`, (a.invoiceNo || "invoice") + ".pdf").catch((e) => setMsg(e.message))}>Invoice</button>}
            {a.status !== "cancelled" && <button className="ghost" onClick={() => openVideo(a._id, setMsg)}>Video call</button>}
            {a.status !== "cancelled" && <button className="ghost" onClick={() => download(`/prescriptions/${a._id}/pdf`, "prescription.pdf").catch((e) => setMsg(e.message))}>Prescription</button>}
            {a.status === "booked" && <button className="ghost" onClick={() => api(`/appointments/${a._id}/cancel`, "PATCH").then(load)}>{t("cancel")}</button>}
            {a.status === "done" && <Rate a={a} />}
          </span>
        </div>))}
    </>
  );
}

export function ReminderWatcher({ onFire }) {
  // Runs for the whole session, so alerts work on every tab while MediSync is open.
  const list = useRef([]);
  useEffect(() => {
    const pull = () => api("/reminders").then((l) => { list.current = l; }).catch(() => {});
    const check = () => {
      const now = new Date(), mins = now.getHours() * 60 + now.getMinutes(), day = now.toDateString();
      const fired = JSON.parse(localStorage.firedReminders || "{}");
      let changed = false;
      list.current.filter((r) => r.active).forEach((r) => {
        const [h, m] = r.time.split(":").map(Number), at = h * 60 + m, key = r._id + r.time;
        if (mins >= at && mins - at <= 5 && fired[key] !== day) { fired[key] = day; changed = true; onFire(r.medicine + " at " + r.time); }
      });
      if (changed) localStorage.firedReminders = JSON.stringify(fired);
    };
    pull().then(check);
    const a = setInterval(check, 15000), b = setInterval(pull, 30000);
    window.addEventListener("reminders-changed", pull);
    return () => { clearInterval(a); clearInterval(b); window.removeEventListener("reminders-changed", pull); };
  }, []);
  return null;
}

export function Reminders() {
  const t = useT();
  const [list, setList] = useState([]), [m, setM] = useState(""), [time, setTime] = useState("08:00");
  const [perm, setPerm] = useState(canNotify() ? Notification.permission : "unsupported");
  const load = () => api("/reminders").then(setList);
  const changed = () => { load(); window.dispatchEvent(new Event("reminders-changed")); };
  useEffect(() => { load(); }, []);
  const enable = async () => { if (canNotify()) setPerm(await Notification.requestPermission()); beep(); };
  const add = async () => {
    if (!m.trim()) return;
    const r = await api("/reminders", "POST", { medicine: m.trim(), time });
    const [h, mi] = time.split(":").map(Number), now = new Date();
    if (now.getHours() * 60 + now.getMinutes() >= h * 60 + mi) {          // time already passed today: start tomorrow
      const fired = JSON.parse(localStorage.firedReminders || "{}"); fired[r._id + r.time] = now.toDateString();
      localStorage.firedReminders = JSON.stringify(fired);
    }
    setM(""); changed();
  };
  return (
    <>
      <h2>{t("reminders")}</h2>
      <div className="card">
        <b>Alerts: {perm === "granted" ? "On" : perm === "denied" ? "Blocked in browser settings" : perm === "unsupported" ? "Not supported here" : "Off"}</b>
        <p><small>You get a banner, a beep and a notification while MediSync is open in a browser tab. The mobile app can also push alerts when it is closed.</small></p>
        <button onClick={enable}>Enable alerts</button> <button className="ghost" onClick={() => notify("Test reminder")}>Send test alert</button>
      </div>
      <div className="card">
        {list.length === 0 && <p>No reminders yet. Add one below.</p>}
        {list.map((r) => (
          <div className="row" key={r._id}>
            <span><b>{r.medicine}</b><br /><small>Daily at {r.time} · {r.streak || 0}-day streak · {r.week || 0}/7 days this week</small></span>
            <span>
              <button className={r.takenToday ? "on" : "ghost"} aria-pressed={!!r.takenToday} onClick={() => api(`/reminders/${r._id}/taken`, "POST", { taken: !r.takenToday }).then(load)}>{r.takenToday ? "Taken today ✓" : "Mark taken"}</button>
              <button className="ghost" onClick={() => api("/reminders/" + r._id, "PATCH", { active: !r.active }).then(changed)}>{r.active ? "On" : "Off"}</button>
              <button className="ghost" onClick={() => api("/reminders/" + r._id, "DELETE").then(changed)}>Delete</button>
            </span>
          </div>))}
        <div className="row"><input aria-label="Medicine name" placeholder="Medicine name" value={m} onChange={(e) => setM(e.target.value)} />
          <input aria-label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ maxWidth: 130 }} /></div>
        <button onClick={add}>Add reminder</button>
      </div>
    </>
  );
}

export function Records() {
  const t = useT();
  const [list, setList] = useState([]), [title, setTitle] = useState(""), [type, setType] = useState("Report"), [file, setFile] = useState(null), [msg, setMsg] = useState("");
  const fileRef = useRef();
  const load = () => api("/records").then(setList);
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!title.trim()) { setMsg("Enter a record name."); return; }
    const fd = new FormData(); fd.append("title", title.trim()); fd.append("type", type); if (file) fd.append("file", file);
    try { await api("/records", "POST", fd); setTitle(""); setFile(null); if (fileRef.current) fileRef.current.value = ""; setMsg("Record saved."); load(); }
    catch (e) { setMsg(e.message); }
  };
  return (
    <>
      <h2>{t("records")}</h2>
      <div className="card">
        {list.length === 0 && <p>No records yet. Add your first report or prescription.</p>}
        {list.map((r) => (
          <div className="row" key={r._id}>
            <span><b>{r.title}</b><br /><small>{r.type} · {r.createdAt.slice(0, 10)}</small></span>
            {r.file && <button className="ghost" onClick={() => download(`/records/${r._id}/file`, r.originalName || "record").catch((e) => setMsg(e.message))}>Open file</button>}
          </div>))}
        <div className="row"><input aria-label="Record name" placeholder="Record name" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option>Report</option><option>Prescription</option></select></div>
        <label>Attach a file (PDF, PNG or JPG, up to 5 MB) <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
        <button onClick={add}>Add record</button>
        {msg && <p role="status">{msg}</p>}
      </div>
    </>
  );
}

export function Symptoms() {
  const t = useT();
  const [text, setText] = useState(""), [res, setRes] = useState(null), [err, setErr] = useState("");
  const go = () => { setErr(""); api("/symptoms", "POST", { text }).then(setRes).catch((e) => { setRes(null); setErr(e.message); }); };
  return (
    <>
      <h2>{t("symptoms")}</h2>
      <div className="card">
        <textarea aria-label="Symptoms" rows="3" placeholder="Example: fever and sore throat" value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={go}>Suggest a specialist</button>
        {err && <p className="err">{err}</p>}
        {res && <div className={"res " + (res.urgent ? "urgent" : "")}>
          <b>{res.urgent ? res.specialty : "See a " + res.specialty}</b>
          <p>{res.advice}</p>
          <small>{res.source === "ai" ? "AI suggestion" : "Basic keyword check"}</small>
          {res.doctors.map((d) => <small key={d._id} style={{ display: "block" }}>{d.name} · ₹{d.fee}</small>)}
        </div>}
      </div>
    </>
  );
}

export function Chat() {
  const t = useT();
  const [apts, setApts] = useState([]), [room, setRoom] = useState(""), [msgs, setMsgs] = useState([]), [text, setText] = useState("");
  const sock = useRef(null), end = useRef(null), isDoc = localStorage.role === "doctor";
  useEffect(() => { api(isDoc ? "/appointments/doctor" : "/appointments/mine").then((a) => setApts(a.filter((x) => x.status !== "cancelled"))); }, []);
  useEffect(() => {
    if (!room) return;
    setMsgs([]);
    const s = io(SOCKET_URL, { auth: { token: localStorage.token } }); sock.current = s;
    s.emit("join", room, (ok) => ok ? api("/chat/" + room).then(setMsgs) : setMsgs([{ _id: "x", name: "System", text: "You cannot open this chat." }]));
    s.on("chat", (m) => setMsgs((p) => [...p, m]));
    return () => s.disconnect();
  }, [room]);
  useEffect(() => { end.current?.scrollIntoView(); }, [msgs]);
  const send = () => { if (text.trim() && room) { sock.current.emit("chat", { room, text: text.trim() }); setText(""); } };
  return (
    <>
      <h2>{t("chat")}</h2>
      <select aria-label="Appointment" value={room} onChange={(e) => setRoom(e.target.value)}>
        <option value="">Choose an appointment</option>
        {apts.map((a) => <option key={a._id} value={a._id}>{isDoc ? a.patient?.name : a.doctor?.name} · {a.date} {a.time}</option>)}
      </select>
      {room && <div className="card">
        <div className="chat" aria-live="polite">{msgs.map((m) => <p key={m._id}><b>{m.name}: </b>{m.text}</p>)}<div ref={end} /></div>
        <div className="row"><input aria-label="Message" value={text} placeholder="Type a message" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <button onClick={send}>{t("send")}</button></div>
      </div>}
    </>
  );
}

export function Emergency() {
  const t = useT();
  const [c, setC] = useState({ name: "", phone: "" }), [msg, setMsg] = useState("");
  const save = () => api("/sos/contact", "PUT", c).then(() => setMsg("Contact saved")).catch((e) => setMsg(e.message));
  const sos = () => navigator.geolocation.getCurrentPosition(
    (p) => api("/sos", "POST", { lat: p.coords.latitude, lng: p.coords.longitude })
      .then((d) => setMsg(d.sent ? "SMS sent to " + d.contact + ". In a real emergency, also call 112."
        : "Alert saved, but SMS is not set up on this server, so " + d.contact + " was not texted. Call 112 or your contact now."))
      .catch((e) => setMsg(e.message)),
    () => setMsg("Allow location access to send an alert."));
  return (
    <>
      <h2>{t("emergency")}</h2>
      <div className="card">
        <input aria-label="Contact name" placeholder="Contact name" onChange={(e) => setC({ ...c, name: e.target.value })} />
        <input aria-label="Contact phone" placeholder="Contact phone" inputMode="tel" onChange={(e) => setC({ ...c, phone: e.target.value })} />
        <button className="ghost" onClick={save}>Save contact</button>
      </div>
      <button className="sos" onClick={sos}>Send SOS with my location</button>
      {msg && <p role="status">{msg}</p>}
    </>
  );
}
