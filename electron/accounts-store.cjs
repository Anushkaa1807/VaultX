const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { app } = require("electron");

const ACCOUNTS_FILE = "accounts.json";

// Get account registry path.
function getAccountsPath() {
  return path.join(
    app.getPath("userData"),
    ACCOUNTS_FILE
  );
}

// Read registered accounts.
async function getAccounts() {
  try {
    const content = await fs.readFile(
      getAccountsPath(),
      "utf8"
    );

    const accounts = JSON.parse(content);

    if (!Array.isArray(accounts)) {
      throw new Error("Invalid account registry.");
    }

    return accounts;
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

// Save account registry.
async function saveAccounts(accounts) {
  const filePath = getAccountsPath();
  const temporaryPath = filePath + ".tmp";

  try {
    await fs.writeFile(
      temporaryPath,
      JSON.stringify(accounts, null, 2),
      {
        encoding: "utf8",
        mode: 0o600,
      }
    );

    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    await fs.rm(temporaryPath, {
      force: true,
    }).catch(() => {});

    throw error;
  }
}

// Find account by username.
async function findAccount(username) {
  const accounts = await getAccounts();

  const normalizedUsername = username
    .trim()
    .toLowerCase();

  return (
    accounts.find(
      (account) =>
        account.username === normalizedUsername
    ) || null
  );
}

// Register a new account.
async function registerAccount(username) {
  const normalizedUsername = username
    .trim()
    .toLowerCase();

  if (
    normalizedUsername.length < 3 ||
    normalizedUsername.length > 30
  ) {
    throw new Error(
      "Username must be between 3 and 30 characters."
    );
  }

  if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
    throw new Error(
      "Username can only contain letters, numbers, and underscores."
    );
  }

  const accounts = await getAccounts();

  const alreadyExists = accounts.some(
    (account) =>
      account.username === normalizedUsername
  );

  if (alreadyExists) {
    throw new Error("Username already exists.");
  }

  const account = {
    id: crypto.randomUUID(),
    username: normalizedUsername,
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);

  await saveAccounts(accounts);

  return account;
}

// Remove account metadata if account creation fails.
async function removeAccount(accountId) {
  const accounts = await getAccounts();

  const updatedAccounts = accounts.filter(
    (account) => account.id !== accountId
  );

  await saveAccounts(updatedAccounts);
}

// Export account functions.
module.exports = {
  getAccounts,
  findAccount,
  registerAccount,
  removeAccount,
};
