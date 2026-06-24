import "./styles.css";

type SignalSnapshot = {
  ssid?: string;
  rssi?: number;
  band?: string;
  channel?: number;
  updatedAt: string;
  error?: string;
};

declare global {
  interface Window {
    wifiSignal?: {
      getSignal: () => Promise<SignalSnapshot>;
    };
  }
}

const networkName = document.querySelector<HTMLHeadingElement>("#networkName")!;
const signalNumber = document.querySelector<HTMLSpanElement>("#signalNumber")!;
const qualityText = document.querySelector<HTMLElement>("#qualityText")!;
const signalHint = document.querySelector<HTMLSpanElement>("#signalHint")!;
const bandText = document.querySelector<HTMLSpanElement>("#bandText")!;
const channelText = document.querySelector<HTMLSpanElement>("#channelText")!;
const updatedText = document.querySelector<HTMLSpanElement>("#updatedText")!;
const refreshButton = document.querySelector<HTMLButtonElement>("#refreshButton")!;
let refreshing = false;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function signalPosition(rssi?: number) {
  if (typeof rssi !== "number") return 0;
  return clamp(((rssi + 90) / 55) * 100, 0, 100);
}

function qualityFor(rssi?: number) {
  if (typeof rssi !== "number") {
    return {
      name: "No signal",
      color: "#8a8177",
      soft: "rgba(138, 129, 119, 0.22)",
      hint: "Connect to Wi-Fi or refresh."
    };
  }
  if (rssi >= -55) {
    return {
      name: "Strong",
      color: "#18a05f",
      soft: "rgba(24, 160, 95, 0.22)",
      hint: "You are close to the router."
    };
  }
  if (rssi >= -67) {
    return {
      name: "Good",
      color: "#72b84b",
      soft: "rgba(114, 184, 75, 0.24)",
      hint: "This is a good Wi-Fi spot."
    };
  }
  if (rssi >= -75) {
    return {
      name: "Fair",
      color: "#d4a62a",
      soft: "rgba(212, 166, 42, 0.25)",
      hint: "Usable, but getting weaker."
    };
  }
  if (rssi >= -85) {
    return {
      name: "Weak",
      color: "#cf6537",
      soft: "rgba(207, 101, 55, 0.26)",
      hint: "Move closer. Walls or distance are hurting signal."
    };
  }
  return {
    name: "Very weak",
    color: "#c83232",
    soft: "rgba(200, 50, 50, 0.28)",
    hint: "Too far away. Expect dropouts here."
  };
}

function setScanning() {
  refreshButton.disabled = true;
  refreshButton.textContent = "Scanning";
  updatedText.textContent = "Updating...";
}

function setIdle() {
  refreshButton.disabled = false;
  refreshButton.textContent = "Refresh";
}

function render(snapshot: SignalSnapshot) {
  const quality = qualityFor(snapshot.rssi);
  document.documentElement.style.setProperty("--signal-color", quality.color);
  document.documentElement.style.setProperty("--signal-soft", quality.soft);
  document.documentElement.style.setProperty("--signal-position", `${signalPosition(snapshot.rssi)}%`);

  networkName.textContent = snapshot.ssid ?? "Wi-Fi unavailable";
  signalNumber.textContent = typeof snapshot.rssi === "number" ? String(snapshot.rssi) : "--";
  qualityText.textContent = snapshot.error ? "Unavailable" : quality.name;
  signalHint.textContent = snapshot.error ?? quality.hint;
  bandText.textContent = `Band: ${snapshot.band ?? "--"}`;
  channelText.textContent = `Channel: ${snapshot.channel ?? "--"}`;
  updatedText.textContent = `Updated: ${new Date(snapshot.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}`;
}

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  setScanning();
  try {
    const snapshot = await window.wifiSignal?.getSignal();
    render(snapshot ?? {
      updatedAt: new Date().toISOString(),
      error: "Desktop Wi-Fi bridge is not available."
    });
  } catch {
    render({
      updatedAt: new Date().toISOString(),
      error: "Could not read Wi-Fi signal."
    });
  } finally {
    refreshing = false;
    setIdle();
  }
}

refreshButton.addEventListener("click", () => {
  void refresh();
});

void refresh();
window.setInterval(() => {
  void refresh();
}, 3000);
