import crypto from 'crypto';

// AES-256-GCM encryption/decryption and HMAC-SHA256 hashing utilities
// Env vars:
// - BENEFICIARY_ENC_KEY: 32-byte key in base64 or hex
// - BENEFICIARY_HASH_KEY: key for HMAC (any length), base64 or hex or utf8

export type EncryptedField = {
  alg: 'aes-256-gcm';
  iv: string; // base64
  tag: string; // base64
  data: string; // base64
};

const getBufferFromEnv = (value?: string): Buffer | null => {
  if (!value) return null;
  // Try base64, then hex, else utf8
  try { return Buffer.from(value, 'base64'); } catch {}
  try { return Buffer.from(value, 'hex'); } catch {}
  return Buffer.from(value, 'utf8');
};

const getAesKey = (): Buffer => {
  const keyStr = process.env.BENEFICIARY_ENC_KEY;
  const key = getBufferFromEnv(keyStr);
  if (!key || key.length !== 32) {
    throw new Error('BENEFICIARY_ENC_KEY must be a 32-byte key (provide as base64 or hex)');
  }
  return key;
};

const getHmacKey = (): Buffer => {
  const keyStr = process.env.BENEFICIARY_HASH_KEY;
  const key = getBufferFromEnv(keyStr);
  if (!key || key.length < 16) {
    throw new Error('BENEFICIARY_HASH_KEY must be provided (>=16 bytes recommended)');
  }
  return key;
};

export const encryptField = (plaintext: string | null | undefined): EncryptedField | null => {
  if (plaintext === undefined || plaintext === null || plaintext === '') return null;
  const key = getAesKey();
  const iv = crypto.randomBytes(12); // GCM standard
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: enc.toString('base64'),
  };
};

export const decryptField = (encrypted: EncryptedField | null | undefined): string | null => {
  if (!encrypted) return null;
  const key = getAesKey();
  const iv = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  const data = Buffer.from(encrypted.data, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
};

export const hmacSha256 = (value: string): string => {
  const key = getHmacKey();
  const h = crypto.createHmac('sha256', key);
  h.update(value, 'utf8');
  return h.digest('hex');
};

// Normalizers for deterministic keys
export const normalizeName = (s?: string | null): string => {
  if (!s) return '';
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
};

export const normalizeDob = (s?: string | null): string => {
  if (!s) return '';
  // Accept YYYY-MM-DD or other date strings and normalize to YYYY-MM-DD
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const normalizePhone = (s?: string | null): string => {
  if (!s) return '';
  // Keep digits and leading +
  const trimmed = s.trim();
  const plus = trimmed.startsWith('+') ? '+' : '';
  const digits = trimmed.replace(/[^0-9]/g, '');
  return plus + digits;
};

export const makePseudonym = (): string => {
  // Generate short pseudonymized code
  return 'B-' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

export default {
  encryptField,
  decryptField,
  hmacSha256,
  normalizeName,
  normalizeDob,
  normalizePhone,
  makePseudonym,
};
