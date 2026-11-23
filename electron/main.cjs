
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

const {
  createVault,
  saveVault,
  loadVault,
  vaultExists,
} = require("./vault-store.cjs");

const {
  getAccounts,
  findAccount,
  registerAccount,
  removeAccount,
} = require("./accounts-store.cjs");

let unlockedVault = null;
let vaultKey = null;
let vaultSalt = null;
let currentAccount = null;

// Verify requests from the trusted main renderer.
function isTrustedSender(event) {
  const senderFrame = event.senderFrame;

  if (!senderFrame || senderFrame !== event.sender.mainFrame) {
    return false;
  }

  try {
    const url = new URL(senderFrame.url);

    return (
      url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.port === "5175" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

// Clear sensitive in-memory vault state.
function clearVaultState() {
  if (Buffer.isBuffer(vaultKey)) {
    vaultKey.fill(0);
  }

  if (Buffer.isBuffer(vaultSalt)) {
    vaultSalt.fill(0);
  }

  vaultKey = null;
  vaultSalt = null;
  unlockedVault = null;
  currentAccount = null;
}

// Register protected IPC handlers.
function registerVaultHandlers() {

  // Backend connection test.
  ipcMain.handle("vaultx:ping", (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("Unauthorized IPC request");
    }

    return {
      status: "connected",
      message: "VaultX backend is responding",
    };
  });

  // Get registered accounts.
  ipcMain.handle("vaultx:accounts", async (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("Unauthorized IPC request");
    }

    const accounts = await getAccounts();

    return accounts.map((account) => ({
      username: account.username,
      createdAt: account.createdAt,
    }));
  });

  // Check whether any accounts exist.
  ipcMain.handle("vaultx:exists", async (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("Unauthorized IPC request");
    }

    const accounts = await getAccounts();

    return accounts.length > 0;
  });

  // Register a new account and create its encrypted vault.
  ipcMain.handle(
    "vaultx:register",
    async (event, username, password) => {
      if (!isTrustedSender(event)) {
        throw new Error("Unauthorized IPC request");
      }

      if (unlockedVault !== null) {
        throw new Error("Please log out before creating another account.");
      }

      if (
        typeof username !== "string" ||
        typeof password !== "string"
      ) {
        throw new Error("Invalid account details.");
      }

      if (password.length < 12) {
        throw new Error(
          "Master password must contain at least 12 characters."
        );
      }

      let account = null;
      let result = null;

      try {
        account = await registerAccount(username);

        if (await vaultExists(account.id)) {
          throw new Error("Account vault already exists.");
        }

        result = await createVault(account.id, password);

        currentAccount = account;
        unlockedVault = [];
        vaultKey = result.key;
        vaultSalt = result.salt;

        return {
          success: true,
          message: "Account created successfully.",
          username: account.username,
        };
      } catch (error) {
        if (result && Buffer.isBuffer(result.key)) {
          result.key.fill(0);
        }

        if (account) {
          await removeAccount(account.id).catch(() => {});
        }

        throw error;
      }
    }
  );

  // Login to an existing account.
  ipcMain.handle(
    "vaultx:login",
    async (event, username, password) => {
      if (!isTrustedSender(event)) {
        throw new Error("Unauthorized IPC request");
      }

      if (unlockedVault !== null) {
        throw new Error("Please log out first.");
      }

      if (
        typeof username !== "string" ||
        typeof password !== "string"
      ) {
        throw new Error("Invalid login details.");
      }

      const account = await findAccount(username);

      if (!account) {
        throw new Error("Invalid username or master password.");
      }

      if (!(await vaultExists(account.id))) {
        throw new Error("Account vault not found.");
      }

      let result;

      try {
        result = await loadVault(account.id, password);
      } catch {
        throw new Error("Invalid username or master password.");
      }

      currentAccount = account;
      unlockedVault = result.data;
      vaultKey = result.key;
      vaultSalt = result.salt;

      return {
        success: true,
        message: "Login successful.",
        username: account.username,
      };
    }
  );

  // Save updated vault entries.
  ipcMain.handle("vaultx:save", async (event, data) => {
    if (!isTrustedSender(event)) {
      throw new Error("Unauthorized IPC request");
    }

    if (
      unlockedVault === null ||
      vaultKey === null ||
      vaultSalt === null ||
      currentAccount === null
    ) {
      throw new Error("Vault is locked.");
    }

    if (!Array.isArray(data)) {
      throw new Error("Invalid vault data.");
    }

    await saveVault(
      currentAccount.id,
      data,
      vaultKey,
      vaultSalt
    );

    unlockedVault = data;

    return {
      success: true,
      message: "Vault saved successfully.",
    };
  });

  // Retrieve decrypted vault entries.
  ipcMain.handle("vaultx:get-entries", (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("Unauthorized IPC request");
    }

    if (unlockedVault === null) {
      throw new Error("Vault is locked.");
    }

    return unlockedVault;
  });

  // Logout and clear decrypted data.
  ipcMain.handle("vaultx:logout", (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("Unauthorized IPC request");
    }

    clearVaultState();

    return {
      success: true,
      message: "Logged out successfully.",
    };
  });

  // Lock vault (same behavior as logout).
  ipcMain.handle("vaultx:lock", (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("Unauthorized IPC request");
    }

    clearVaultState();

    return {
      success: true,
      message: "Vault locked successfully.",
    };
  });

  // Get vault and account status.
  ipcMain.handle("vaultx:status", async (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("Unauthorized IPC request");
    }

    const accounts = await getAccounts();

    return {
      exists: accounts.length > 0,
      unlocked: unlockedVault !== null,
      loggedIn: currentAccount !== null,
      username: currentAccount?.username || null,
      accounts: accounts.map((account) => ({
        username: account.username,
        createdAt: account.createdAt,
      })),
    };
  });
}

// Create application window.
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "VaultX - Password Manager",

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL("http://127.0.0.1:5175");
}

// Start application.
app.whenReady().then(() => {
  registerVaultHandlers();

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Clear sensitive state before shutdown.
app.on("before-quit", () => {
  clearVaultState();
});

// Handle window closing.
app.on("window-all-closed", () => {
  clearVaultState();

  if (process.platform !== "darwin") {
    app.quit();
  }
});
