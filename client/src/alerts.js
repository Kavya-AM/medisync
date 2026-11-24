export const canNotify = () => "Notification" in window;

export function beep() {
  try {
    const C = window.AudioContext || window.webkitAudioContext, a = new C(), o = a.createOscillator(), g = a.createGain();
    o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = 0.15; o.start();
    setTimeout(() => { o.stop(); a.close(); }, 500);
  } catch { /* sound is optional */ }
}

export function notify(text) {
  beep();
  if (canNotify() && Notification.permission === "granted") {
    try { new Notification("MediSync reminder", { body: text }); } catch { /* ignore */ }
  }
}
