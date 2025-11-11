import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import crypto from 'crypto';
import { MfaTempToken } from '../models';

// Configure TOTP defaults
authenticator.options = {
  step: 30,
  digits: 6,
  window: 1
};

export type TempTokenRecord = {
  userId: string;
  expiresAt: number; // epoch ms
  used?: boolean;
  attempts: number;
};

// Legacy in-memory map retained only for backwards-compat in other flows; DB is the source of truth for MFA temp tokens
const tempTokens = new Map<string, TempTokenRecord>();
const pendingSecrets = new Map<string, string>(); // userId -> base32 secret
const recoveryCodesStore = new Map<string, string[]>(); // userId -> hashed codes
// Enrollment tokens for code-less confirmation
type EnrollmentTokenRecord = { userId: string; expiresAt: number; used?: boolean };
const enrollmentTokens = new Map<string, EnrollmentTokenRecord>();

export async function issueTempToken(userId: string, ttlMs = 5 * 60 * 1000): Promise<string> {
  const token = crypto.randomBytes(24).toString('hex');
  await MfaTempToken.create({
    userId,
    token,
    expiresAt: new Date(Date.now() + ttlMs),
    used: false,
    attempts: 0,
  });
  return token;
}

export async function consumeTempToken(token: string): Promise<{ ok: boolean; userId?: string; reason?: string }> {
  const row = await MfaTempToken.findOne({ where: { token } });
  if (!row) return { ok: false, reason: 'invalid' };
  if (row.used) return { ok: false, reason: 'used' };
  if (Date.now() > row.expiresAt.getTime()) {
    await row.destroy();
    return { ok: false, reason: 'expired' };
  }
  row.used = true;
  await row.save();
  return { ok: true, userId: row.userId };
}

export async function recordTempAttempt(token: string): Promise<number> {
  const row = await MfaTempToken.findOne({ where: { token } });
  if (!row) return 0;
  row.attempts = (row.attempts || 0) + 1;
  await row.save();
  return row.attempts;
}

// Peek at a temp token without consuming it
export async function getTempToken(token: string): Promise<{ ok: boolean; userId?: string; reason?: string }> {
  const row = await MfaTempToken.findOne({ where: { token } });
  if (!row) return { ok: false, reason: 'invalid' };
  if (row.used) return { ok: false, reason: 'used' };
  if (Date.now() > row.expiresAt.getTime()) {
    await row.destroy();
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, userId: row.userId };
}

// Mark a temp token as used (after successful verification)
export async function markTempTokenUsed(token: string): Promise<void> {
  const row = await MfaTempToken.findOne({ where: { token } });
  if (!row) return;
  row.used = true;
  await row.save();
}

// Invalidate a temp token (e.g., after too many failed attempts)
export async function invalidateTempToken(token: string): Promise<void> {
  await MfaTempToken.destroy({ where: { token } });
}

export function startSetup(userId: string): { secret: string; otpauthUrl: string } {
  const secret = authenticator.generateSecret();
  const label = process.env.TOTP_LABEL || 'Caritas';
  const accountName = userId; // can be email, but use user identifier if email not available here
  const otpauthUrl = authenticator.keyuri(accountName, label, secret);
  pendingSecrets.set(userId, secret);
  return { secret, otpauthUrl };
}

export async function toQrDataUrl(text: string): Promise<string> {
  return qrcode.toDataURL(text);
}

export function getPendingSecret(userId: string): string | undefined {
  return pendingSecrets.get(userId);
}

export function clearPendingSecret(userId: string): void {
  pendingSecrets.delete(userId);
}

export function verifyTotp(secret: string, code: string): boolean {
  return authenticator.verify({ token: code, secret });
}

export function generateRecoveryCodes(count = 10): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    const grouped = raw.match(/.{1,4}/g)?.join('-') || raw;
    plain.push(grouped);
    const hash = crypto.createHash('sha256').update(grouped).digest('hex');
    hashed.push(hash);
  }
  return { plain, hashed };
}

export function saveRecoveryCodes(userId: string, hashes: string[]): void {
  recoveryCodesStore.set(userId, hashes);
}

export function listRecoveryCodes(userId: string): string[] | undefined {
  return recoveryCodesStore.get(userId);
}

export function consumeRecoveryCode(userId: string, candidate: string): boolean {
  const hashes = recoveryCodesStore.get(userId);
  if (!hashes) return false;
  const candHash = crypto.createHash('sha256').update(candidate).digest('hex');
  const idx = hashes.indexOf(candHash);
  if (idx === -1) return false;
  hashes.splice(idx, 1);
  recoveryCodesStore.set(userId, hashes);
  return true;
}

// Issue a short-lived, single-use enrollment token for code-less setup confirmation
export function issueEnrollmentToken(userId: string, ttlMs = 10 * 60 * 1000): string {
  const token = crypto.randomBytes(24).toString('hex');
  enrollmentTokens.set(token, { userId, expiresAt: Date.now() + ttlMs, used: false });
  return token;
}

// Consume an enrollment token and return associated userId
export function consumeEnrollmentToken(token: string): { ok: boolean; userId?: string; reason?: string } {
  const rec = enrollmentTokens.get(token);
  if (!rec) return { ok: false, reason: 'invalid' };
  if (rec.used) return { ok: false, reason: 'used' };
  if (Date.now() > rec.expiresAt) {
    enrollmentTokens.delete(token);
    return { ok: false, reason: 'expired' };
  }
  rec.used = true;
  enrollmentTokens.set(token, rec);
  return { ok: true, userId: rec.userId };
}
