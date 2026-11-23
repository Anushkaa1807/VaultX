const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");

const {
  createVaultKey,
  encryptVaultWithKey,
  decryptVaultWithKey,
} = require("./vault-crypto.cjs");

const VAULT_FILE = "vault.enc";

// Get account-specific vault path.
function getVaultPath(accountId) {
  if (!accountId || !/^[a-zA-Z0-9-]+$/.test(accountId)) {
    throw new Error("Invalid account ID.");
  }

  return path.join(
    app.getPath("userData"),
    "accounts",
    accountId,
    VAULT_FILE
  );
}

// Check if an account vault exists.
async function vaultExists(accountId) {
  try {
    await fs.access(getVaultPath(accountId));
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

// Write encrypted vault safely.
async function writeEncryptedVault(accountId, encryptedData) {
  const filePath = getVaultPath(accountId);
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.tmp`;

  await fs.mkdir(directory, { recursive: true });

  try {
    await fs.writeFile(
      temporaryPath,
      JSON.stringify(encryptedData, null, 2),
      {
        encoding: "utf8",
        mode: 0o600,
      }
    );

    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

// Create a new encrypted vault.
async function createVault(accountId, masterPassword) {
  const salt = crypto.randomBytes(16);
  const key = await createVaultKey(masterPassword, salt);

  try {
    const encryptedData = encryptVaultWithKey([], key, salt);

    await writeEncryptedVault(accountId, encryptedData);

    return { key, salt };
  } catch (error) {
    key.fill(0);
    throw error;
  }
}

// Load and decrypt an account vault.
async function loadVault(accountId, masterPassword) {
  const filePath = getVaultPath(accountId);

  const content = await fs.readFile(filePath, "utf8");
  const encryptedData = JSON.parse(content);

  if (!encryptedData.salt) {
    throw new Error("Vault salt is missing.");
  }

  const salt = Buffer.from(encryptedData.salt, "base64");
  const key = await createVaultKey(masterPassword, salt);

  try {
    const data = decryptVaultWithKey(encryptedData, key);

    return {
      data,
      key,
      salt,
    };
  } catch (error) {
    key.fill(0);
    throw error;
  }
}

// Save encrypted vault data.
async function saveVault(accountId, data, key, salt) {
  if (!Array.isArray(data)) {
    throw new Error("Vault data must be an array.");
  }

  const encryptedData = encryptVaultWithKey(data, key, salt);

  await writeEncryptedVault(accountId, encryptedData);
}

module.exports = {
  vaultExists,
  createVault,
  loadVault,
  saveVault,
};