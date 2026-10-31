import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("luma", {
  call: async (method: string, data?: unknown) => {
    const r = await ipcRenderer.invoke("luma:call", method, data);
    if (!r.ok) throw Error(r.error);
    return r.value;
  },
  on: (event: string, fn: (data: unknown) => void) => {
    if (!["refresh", "jobs", "log", "auth", "game-exit", "update"].includes(event))
      throw Error("Unknown event");
    const handler = (_: unknown, data: unknown) => fn(data);
    ipcRenderer.on("luma:" + event, handler);
    return () => ipcRenderer.removeListener("luma:" + event, handler);
  },
});
