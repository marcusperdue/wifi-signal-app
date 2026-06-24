import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("wifiSignal", {
  getSignal: () => ipcRenderer.invoke("wifi:getSignal")
});
