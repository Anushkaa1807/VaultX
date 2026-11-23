const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vaultx", {
  // Connection test
  ping: () => ipcRenderer.invoke("vaultx:ping"),

  // Account management
  getVaultStatus: () =>
    ipcRenderer.invoke("vaultx:status"),

  registerAccount: (username, masterPassword) =>
    ipcRenderer.invoke(
      "vaultx:register",
      username,
      masterPassword
    ),

  login: (username, masterPassword) =>
    ipcRenderer.invoke(
      "vaultx:login",
      username,
      masterPassword
    ),

  logout: () =>
    ipcRenderer.invoke("vaultx:logout"),

  // Password management
  getVaultEntries: () =>
    ipcRenderer.invoke("vaultx:get-entries"),

  saveVault: (entries) =>
    ipcRenderer.invoke("vaultx:save", entries),
});