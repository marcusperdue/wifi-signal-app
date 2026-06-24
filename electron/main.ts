import { app, BrowserWindow, ipcMain } from "electron";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = process.env.VITE_DEV_SERVER_URL || !app.isPackaged;

type SignalSnapshot = {
  ssid?: string;
  rssi?: number;
  band?: string;
  channel?: number;
  updatedAt: string;
  error?: string;
};

app.setName("Wi-Fi Signal");

function cleanSsid(value?: string) {
  const ssid = value?.trim();
  if (!ssid) return undefined;
  return /^<redacted>$/i.test(ssid) ? "Connected Wi-Fi" : ssid;
}

function bandFromChannel(channel?: number) {
  if (!channel) return undefined;
  if (channel <= 14) return "2.4GHz";
  if (channel < 200) return "5GHz";
  return "6GHz";
}

async function coreWlanSignal(): Promise<SignalSnapshot> {
  const script = `
import CoreWLAN
import Foundation

let interface = CWWiFiClient.shared().interface()
var result: [String: Any] = [:]
result["ssid"] = interface?.ssid() ?? ""
result["rssi"] = interface?.rssiValue() ?? 0
result["channel"] = interface?.wlanChannel()?.channelNumber ?? 0

let data = try JSONSerialization.data(withJSONObject: result)
print(String(data: data, encoding: .utf8)!)
`;
  const { stdout } = await execFileAsync("swift", ["-e", script], { timeout: 3000 });
  const result = JSON.parse(stdout.trim()) as { ssid?: string; rssi?: number; channel?: number };
  const rssi = typeof result.rssi === "number" && result.rssi < 0 ? result.rssi : undefined;
  const channel = typeof result.channel === "number" && result.channel > 0 ? result.channel : undefined;

  if (typeof rssi !== "number") {
    throw new Error("CoreWLAN did not return RSSI.");
  }

  return {
    ssid: cleanSsid(result.ssid) ?? "Connected Wi-Fi",
    rssi,
    band: bandFromChannel(channel),
    channel,
    updatedAt: new Date().toISOString()
  };
}

async function systemProfilerSignal(): Promise<SignalSnapshot> {
  const { stdout } = await execFileAsync("system_profiler", ["SPAirPortDataType"], { timeout: 25000 });
  const connected = /Status:\s*Connected/i.test(stdout);
  if (!connected) {
    return {
      updatedAt: new Date().toISOString(),
      error: "Wi-Fi is not connected."
    };
  }

  const currentNetwork = stdout.match(/Current Network Information:\n\s+([^:\n]+):/);
  const rssiValue = stdout.match(/Signal \/ Noise:\s*(-?\d+)\s*dBm/i)?.[1];
  const channelMatch = stdout.match(/Channel:\s*(\d+)\s*\((2GHz|5GHz|6GHz)/i);
  const channel = channelMatch?.[1] ? Number(channelMatch[1]) : undefined;

  return {
    ssid: cleanSsid(currentNetwork?.[1]) ?? "Connected Wi-Fi",
    rssi: rssiValue ? Number(rssiValue) : undefined,
    band: channelMatch?.[2] === "2GHz" ? "2.4GHz" : channelMatch?.[2] ?? bandFromChannel(channel),
    channel,
    updatedAt: new Date().toISOString(),
    error: rssiValue ? undefined : "Signal strength is unavailable."
  };
}

async function macSignal(): Promise<SignalSnapshot> {
  try {
    return await coreWlanSignal();
  } catch {
    return systemProfilerSignal();
  }
}

async function windowsSignal(): Promise<SignalSnapshot> {
  const { stdout } = await execFileAsync("netsh", ["wlan", "show", "interfaces"], { timeout: 8000 });
  const ssid = stdout.match(/^\s*SSID\s*:\s*(.+)$/im)?.[1];
  const channel = stdout.match(/^\s*Channel\s*:\s*(\d+)$/im)?.[1];
  const signalPercent = stdout.match(/^\s*Signal\s*:\s*(\d+)%/im)?.[1];
  const rssi = signalPercent ? Math.round(Number(signalPercent) / 2 - 100) : undefined;

  return {
    ssid: cleanSsid(ssid) ?? "Connected Wi-Fi",
    rssi,
    band: bandFromChannel(channel ? Number(channel) : undefined),
    channel: channel ? Number(channel) : undefined,
    updatedAt: new Date().toISOString(),
    error: rssi ? undefined : "Signal strength is unavailable."
  };
}

async function getSignal(): Promise<SignalSnapshot> {
  try {
    if (process.platform === "darwin") return await macSignal();
    if (process.platform === "win32") return await windowsSignal();
    return {
      updatedAt: new Date().toISOString(),
      error: "Live Wi-Fi signal is only implemented for macOS and Windows right now."
    };
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      error: "Could not read Wi-Fi signal."
    };
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 760,
    height: 760,
    minWidth: 520,
    minHeight: 600,
    title: "Wi-Fi Signal",
    backgroundColor: "#f5f2ec",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    window.loadURL("http://127.0.0.1:5173");
  } else {
    window.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("wifi:getSignal", getSignal);

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
