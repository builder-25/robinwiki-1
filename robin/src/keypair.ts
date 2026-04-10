import {
  generateKeyPairSync,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
  hkdfSync,
} from 'node:crypto'

export interface Keypair {
  publicKey: string // hex-encoded SPKI DER
  encryptedPrivateKey: string // base64: iv(12) + authTag(16) + ciphertext
}

export function generateKeypair(encryptionSecret: string): Keypair {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
    publicKeyEncoding: { type: 'spki', format: 'der' },
  })

  const publicKeyHex = publicKey.toString('hex')
  const keyMaterial = Buffer.from(
    hkdfSync('sha256', encryptionSecret, '', 'robin-keypair-encryption', 32)
  )
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyMaterial, iv)
  const encrypted = Buffer.concat([cipher.update(privateKey), cipher.final()])
  const authTag = cipher.getAuthTag()

  const packed = Buffer.concat([iv, authTag, encrypted])
  return {
    publicKey: publicKeyHex,
    encryptedPrivateKey: packed.toString('base64'),
  }
}

export function decryptPrivateKey(encryptedPrivateKey: string, encryptionSecret: string): Buffer {
  if (!encryptedPrivateKey) throw new Error('No encrypted private key')
  const packed = Buffer.from(encryptedPrivateKey, 'base64')
  if (packed.length < 29) throw new Error('Encrypted private key too short')
  const iv = packed.subarray(0, 12)
  const authTag = packed.subarray(12, 28)
  const ciphertext = packed.subarray(28)

  const keyMaterial = Buffer.from(
    hkdfSync('sha256', encryptionSecret, '', 'robin-keypair-encryption', 32)
  )
  const decipher = createDecipheriv('aes-256-gcm', keyMaterial, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex')
}
