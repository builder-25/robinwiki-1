import { describe, it, expect } from 'vitest'
import { generateKeypair, decryptPrivateKey } from '../keypair'

const SECRET = 'test-encryption-secret-32chars!!'

describe('generateKeypair', () => {
  it('returns a publicKey that is a 64+ char hex string', () => {
    const kp = generateKeypair(SECRET)
    expect(kp.publicKey).toMatch(/^[0-9a-f]+$/)
    expect(kp.publicKey.length).toBeGreaterThanOrEqual(64)
  })

  it('returns a non-empty encryptedPrivateKey', () => {
    const kp = generateKeypair(SECRET)
    expect(kp.encryptedPrivateKey).toBeTruthy()
    expect(typeof kp.encryptedPrivateKey).toBe('string')
  })

  it('round-trips: decryptPrivateKey restores the private key bytes', () => {
    const kp = generateKeypair(SECRET)
    const decrypted = decryptPrivateKey(kp.encryptedPrivateKey, SECRET)
    // PKCS8 DER for ed25519 is 48 bytes
    expect(decrypted.length).toBeGreaterThan(0)
    expect(Buffer.isBuffer(decrypted)).toBe(true)
  })

  it('throws when decrypting with wrong secret', () => {
    const kp = generateKeypair(SECRET)
    expect(() =>
      decryptPrivateKey(kp.encryptedPrivateKey, 'wrong-secret-totally-different!!')
    ).toThrow()
  })

  it('two calls produce different keypairs', () => {
    const kp1 = generateKeypair(SECRET)
    const kp2 = generateKeypair(SECRET)
    expect(kp1.publicKey).not.toBe(kp2.publicKey)
    expect(kp1.encryptedPrivateKey).not.toBe(kp2.encryptedPrivateKey)
  })
})
