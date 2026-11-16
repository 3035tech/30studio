import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { SOCIAL_CONNECTION } from "@/lib/constants";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const ENVELOPE_SEPARATOR = ".";

function getEncryptionKey() {
  const configuredKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  if (!configuredKey || !/^[\da-fA-F]{64}$/u.test(configuredKey)) {
    throw new Error("Social token encryption is not configured.");
  }
  const key = Buffer.from(configuredKey, "hex");
  if (key.byteLength !== KEY_BYTES) throw new Error("Social token encryption key is invalid.");
  return key;
}

export function isSocialTokenEncryptionConfigured() {
  const configuredKey = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  return Boolean(configuredKey && /^[\da-fA-F]{64}$/u.test(configuredKey));
}

export function encryptSocialSecret(secret: string) {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const envelope = [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url"));
  return { ciphertext: envelope.join(ENVELOPE_SEPARATOR), keyVersion: SOCIAL_CONNECTION.encryptionKeyVersion };
}

export function decryptSocialSecret(envelope: string, keyVersion: number) {
  if (keyVersion !== SOCIAL_CONNECTION.encryptionKeyVersion) throw new Error("Social token encryption key version is unsupported.");
  const [ivPart, authTagPart, ciphertextPart, extraPart] = envelope.split(ENVELOPE_SEPARATOR);
  if (!ivPart || !authTagPart || !ciphertextPart || extraPart !== undefined) throw new Error("Social token ciphertext is invalid.");
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const ciphertext = Buffer.from(ciphertextPart, "base64url");
  if (iv.byteLength !== IV_BYTES || authTag.byteLength !== AUTH_TAG_BYTES) throw new Error("Social token ciphertext is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
