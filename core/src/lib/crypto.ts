import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Symmetric envelope encryption using AES-256-GCM.
 *
 * Data layout:
 *   - A server-wide MASTER_KEY (32 bytes, hex in env) wraps per-user DEKs.
 *   - Each user's DEK is a fresh 32-byte random key, stored in
 *     `users.encrypted_dek` as: base64(iv(12) || tag(16) || ciphertext).
 *   - Sensitive config values (OpenRouter API keys, etc.) are encrypted
 *     with the user's DEK and stored in `configs.value` with `encrypted=true`.
 *
 * Ciphertext envelope format for both wrap and data encryption:
 *   [ iv (12 bytes) | auth tag (16 bytes) | ciphertext (variable) ]
 *   Encoded as base64.
 */

const ALGO = 'aes-256-gcm'
const KEY_LEN = 32 // 256 bits
const IV_LEN = 12 // 96 bits — recommended for GCM
const TAG_LEN = 16 // 128 bits

/**
 * Load the master key from MASTER_KEY env var (64 hex chars = 32 bytes).
 * Throws if missing or malformed. Called at boot before any crypto ops.
 */
export function loadMasterKey(): Buffer {
  const hex = process.env.MASTER_KEY
  if (!hex) {
    throw new Error(
      'MASTER_KEY env var is required (64 hex chars = 32 bytes). Generate with: openssl rand -hex 32'
    )
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('MASTER_KEY must be exactly 64 hex characters (32 bytes)')
  }
  return Buffer.from(hex, 'hex')
}

/** Generate a new 32-byte data encryption key. */
export function generateDek(): Buffer {
  return randomBytes(KEY_LEN)
}

/**
 * Encrypt `plaintext` with `key` (32 bytes) using AES-256-GCM.
 * Returns base64-encoded [iv || tag || ciphertext].
 */
function encrypt(plaintext: string | Buffer, key: Buffer): string {
  if (key.length !== KEY_LEN) {
    throw new Error(`Key must be exactly ${KEY_LEN} bytes`)
  }
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const buf = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext
  const ct = Buffer.concat([cipher.update(buf), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ct]).toString('base64')
}

/**
 * Decrypt a base64-encoded envelope produced by {@link encrypt}.
 * Returns the plaintext as a Buffer.
 */
function decrypt(envelope: string, key: Buffer): Buffer {
  if (key.length !== KEY_LEN) {
    throw new Error(`Key must be exactly ${KEY_LEN} bytes`)
  }
  const raw = Buffer.from(envelope, 'base64')
  if (raw.length < IV_LEN + TAG_LEN) {
    throw new Error('Ciphertext envelope too short')
  }
  const iv = raw.subarray(0, IV_LEN)
  const tag = raw.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const ct = raw.subarray(IV_LEN + TAG_LEN)
  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ct), decipher.final()])
}

/**
 * Wrap a DEK with the master key. Returns the base64 envelope to store
 * in `users.encrypted_dek`.
 */
export function wrapDek(dek: Buffer, masterKey: Buffer): string {
  return encrypt(dek, masterKey)
}

/**
 * Unwrap a stored DEK envelope back to the raw 32-byte key.
 */
export function unwrapDek(wrapped: string, masterKey: Buffer): Buffer {
  const dek = decrypt(wrapped, masterKey)
  if (dek.length !== KEY_LEN) {
    throw new Error(`Unwrapped DEK has wrong length: ${dek.length} (expected ${KEY_LEN})`)
  }
  return dek
}

/**
 * Encrypt a sensitive string (e.g. an API key) with a user's DEK.
 * Returns the base64 envelope to store in `configs.value`.
 */
export function encryptWithDek(plaintext: string, dek: Buffer): string {
  return encrypt(plaintext, dek)
}

/**
 * Decrypt a stored config value back to the plaintext string.
 */
export function decryptWithDek(envelope: string, dek: Buffer): string {
  return decrypt(envelope, dek).toString('utf8')
}
