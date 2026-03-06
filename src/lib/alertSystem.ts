// Web Audio API alert sounds for threat detection

const audioCtx = typeof window !== "undefined" ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;

function ensureContext() {
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

export function playAlertSound(severity: "critical" | "high" | "medium") {
  if (!audioCtx) return;
  ensureContext();

  const now = audioCtx.currentTime;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  oscillator.connect(gain);
  gain.connect(audioCtx.destination);

  if (severity === "critical") {
    // Urgent double-beep
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.setValueAtTime(0, now + 0.1);
    oscillator.frequency.setValueAtTime(880, now + 0.15);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.setValueAtTime(0, now + 0.1);
    gain.gain.setValueAtTime(0.15, now + 0.15);
    gain.gain.exponentialApproachTarget(0.001, 0.05, now + 0.3);
    oscillator.start(now);
    oscillator.stop(now + 0.35);
  } else if (severity === "high") {
    // Single warning tone
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(660, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialApproachTarget(0.001, 0.1, now + 0.2);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  } else {
    // Soft blip
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(520, now);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialApproachTarget(0.001, 0.08, now + 0.15);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendThreatNotification(title: string, body: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, {
      body,
      icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🛡️</text></svg>",
      tag: "logsentry-threat",
      renotify: true,
    });
  } catch {
    // Notifications not supported in this context
  }
}
