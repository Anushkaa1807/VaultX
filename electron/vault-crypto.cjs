
const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);

const KEY_LENGTH = 32;

const SCRYPT_OPTIONS = {
  N: 32768,
  r: 8,
  p: 1,
  maxmem: 128 * 1024 * 1024,
};

// Derive a 256-bit key from the master password.
async function createVaultKey(masterPassword, salt) {
  if (
    typeof masterPassword !== "string" ||
    masterPassword.length < 12
  ) {
    throw new Error(
      "Master password must contain at least 12 characters."
    );
  }

  return scrypt(
    masterPassword,
    salt,
    KEY_LENGTH,
    SCRYPT_OPTIONS
  );
}

// Encrypt data using an existing derived key.
function encryptVaultWithKey(data, key, salt) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_LENGTH) {
    throw new Error("Invalid encryption key.");
  }

  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  const plaintext = Buffer.from(
    JSON.stringify(data),
    "utf8"
  );

  const ciphertext = Buffer.concat([
    cipher.update(plaintext),
    cipher.final(),
  ]);

  return {
    version: 1,
    algorithm: "aes-256-gcm",
    kdf: "scrypt",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

// Decrypt data using an existing derived key.
function decryptVaultWithKey(envelope, key) {
  if (
    !Buffer.isBuffer(key) ||
    key.length !== KEY_LENGTH
  ) {
    throw new Error("Invalid encryption key.");
  }

  if (
    !envelope ||
    envelope.version !== 1 ||
    envelope.algorithm !== "aes-256-gcm" ||
    envelope.kdf !== "scrypt"
  ) {
    throw new Error("Invalid or unsupported vault format.");
  }

  const salt = Buffer.from(envelope.salt, "base64");
  const iv = Buffer.from(envelope.iv, "base64");
  const authTag = Buffer.from(envelope.authTag, "base64");
  const ciphertext = Buffer.from(
    envelope.ciphertext,
    "base64"
  );

  if (
    salt.length !== 16 ||
    iv.length !== 12 ||
    authTag.length !== 16 ||
    ciphertext.length === 0
  ) {
    throw new Error("Invalid vault data.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    iv
  );

  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(plaintext.toString("utf8"));
}

module.exports = {
  createVaultKey,
  encryptVaultWithKey,
  decryptVaultWithKey,
};
