import { useEffect, useState } from "react";
import { api } from "./api";
import { notify } from "./alerts";
import { LANGS, LangCtx, useT } from "./i18n";
import { Book, Chat, Emergency, Records, ReminderWatcher, Reminders, Symptoms } from "./Patient";
import { Admin, DoctorDash } from "./Staff";
import { AdminUsers, AdminVisits, Bell, DoctorProfile, Patients, Profile, Vitals } from "./Extra";

function Prefs({ lang, setLang, theme, setTheme, big, setBig }) {
  return (
    <div className="prefs">
      <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
      <button className="ghost" aria-label="Switch light or dark theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "Light" : "Dark"}</button>
      <button className="ghost" aria-label="Larger text" aria-pressed={big} onClick={() => setBig(!big)}>A+</button>
    </div>
  );
}

function Auth({ onDone, prefs }) {
  const t = useT();
  const resetToken = new URLSearchParams(window.location.search).get("reset");
  const [mode, setMode] = useState(resetToken ? "reset" : "login"), [f, setF] = useState({}), [err, setErr] = useState(""), [info, setInfo] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = async () => {
    setErr(""); setInfo("");
    try {
      if (mode === "forgot") { setInfo((await api("/auth/forgot", "POST", { email: f.email })).message); return; }
      if (mode === "reset") {
        await api("/auth/reset", "POST", { token: resetToken, password: f.password });
        window.history.replaceState(null, "", "/"); setMode("login"); setInfo("Password changed. Log in with your new password."); return;
      }
      const d = await api("/auth/" + mode, "POST", f);
      localStorage.token = d.token; localStorage.name = d.user.name; localStorage.role = d.user.role; onDone();
    } catch (e) { setErr(e.message); }
  };
  const label = { login: t("login"), register: t("register"), forgot: t("sendLink"), reset: t("setPass") }[mode];
  return (
    <div className="card auth" onKeyDown={(e) => e.key === "Enter" && go()}>
      <div className="row"><h1>Medi<span>Sync</span></h1>{prefs}</div>
      {mode === "register" && <input aria-label={t("name")} placeholder={t("name")} onChange={set("name")} />}
      {mode !== "reset" && <input aria-label={t("email")} placeholder={t("email")} type="email" onChange={set("email")} />}
      {mode !== "forgot" && <input aria-label={t("password")} placeholder={mode === "reset" ? t("newPass") : t("password")} type="password" onChange={set("password")} />}
      {err && <p className="err" role="alert">{err}</p>}
      {info && <p role="status">{info}</p>}
      <button onClick={go}>{label}</button>
      {(mode === "login" || mode === "register") && <>
        <a href="#" onClick={(e) => { e.preventDefault(); setMode(mode === "login" ? "register" : "login"); }}>{mode === "login" ? t("newHere") : t("haveAcc")}</a>
        <a href="#" onClick={(e) => { e.preventDefault(); setMode("forgot"); }}>{t("forgot")}</a></>}
      {(mode === "forgot" || mode === "reset") && <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); }}>{t("login")}</a>}
    </div>
  );
}

const TABS = {
  patient: [["book", Book], ["vitals", Vitals], ["reminders", Reminders], ["records", Records], ["symptoms", Symptoms], ["chat", Chat], ["emergency", Emergency], ["profile", Profile]],
  doctor: [["appointments", DoctorDash], ["patients", Patients], ["chat", Chat], ["profile", DoctorProfile]],
  admin: [["insights", Admin], ["visits", AdminVisits], ["users", AdminUsers]],
};

function Shell({ onLogout, prefs }) {
  const t = useT(), [tab, setTab] = useState(0), [alerts, setAlerts] = useState([]);
  const fire = (text) => { notify(text); setAlerts((a) => [...a, { id: Date.now() + Math.random(), text }]); };
  const tabs = TABS[localStorage.role] || TABS.patient, View = tabs[Math.min(tab, tabs.length - 1)][1];
  return (
    <div className="wrap">
      {localStorage.role === "patient" && <ReminderWatcher onFire={fire} />}
      {alerts.length > 0 && (
        <div className="alerts" role="alert">
          {alerts.map((a) => (
            <div key={a.id} className="alert"><span>Time to take {a.text}</span>
              <button onClick={() => setAlerts((x) => x.filter((y) => y.id !== a.id))}>Taken</button></div>))}
        </div>)}
      <header><h1>Medi<span>Sync</span></h1>
        <div className="prefs">{prefs}<Bell /><button className="ghost" onClick={onLogout}>{t("logout")} ({localStorage.name})</button></div></header>
      <nav aria-label="Main">{tabs.map(([k], i) => <button key={k} className={i === tab ? "on" : "ghost"} aria-current={i === tab} onClick={() => setTab(i)}>{t(k)}</button>)}</nav>
      <main><View /></main>
    </div>
  );
}

export default function App() {
  const [ok, setOk] = useState(!!localStorage.token);
  const [lang, setLang] = useState(localStorage.lang || "en");
  const [theme, setTheme] = useState(localStorage.theme || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  const [big, setBig] = useState(localStorage.big === "1");
  useEffect(() => { localStorage.lang = lang; document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { localStorage.theme = theme; document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { localStorage.big = big ? "1" : "0"; document.documentElement.style.fontSize = big ? "20px" : ""; }, [big]);
  const prefs = <Prefs {...{ lang, setLang, theme, setTheme, big, setBig }} />;
  const logout = () => { ["token", "name", "role"].forEach((k) => localStorage.removeItem(k)); setOk(false); };
  return (
    <LangCtx.Provider value={{ lang }}>
      {ok ? <Shell onLogout={logout} prefs={prefs} /> : <Auth onDone={() => setOk(true)} prefs={prefs} />}
    </LangCtx.Provider>
  );
}
