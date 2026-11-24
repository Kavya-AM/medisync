const ROOT = import.meta.env.VITE_API_URL || "";
export const SOCKET_URL = ROOT || undefined;

export async function api(path, method = "GET", body) {
  const form = body instanceof FormData;
  const res = await fetch(ROOT + "/api" + path, {
    method,
    headers: { ...(form ? {} : { "Content-Type": "application/json" }), Authorization: "Bearer " + (localStorage.token || "") },
    body: body ? (form ? body : JSON.stringify(body)) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

// Downloads a protected file (PDF, report) with the login token.
export async function download(path, filename) {
  const res = await fetch(ROOT + "/api" + path, { headers: { Authorization: "Bearer " + localStorage.token } });
  if (!res.ok) {
    let m = "Download failed";
    try { m = (await res.json()).error || m; } catch { /* not json */ }
    throw new Error(m);
  }
  const url = URL.createObjectURL(await res.blob()), a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Opens the video room in a new tab. The tab is opened first so pop-up blockers allow it.
export function openVideo(appointmentId, onError) {
  const w = window.open("", "_blank");
  api(`/appointments/${appointmentId}/video`)
    .then((d) => { if (w) { w.opener = null; w.location = d.url; } else onError("Allow pop-ups to join the call."); })
    .catch((e) => { if (w) w.close(); onError(e.message); });
}
