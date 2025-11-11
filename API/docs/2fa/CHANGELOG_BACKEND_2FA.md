# Backend 2FA Change Log (For Frontend Context)

## Overview
- Implemented TOTP-based 2FA with a two-step login and full lifecycle management.
- Users do NOT have 2FA enabled by default; they must enable it via Profile.
- Added Option A: code-less enrollment using an `enrollmentToken` to confirm setup without entering a TOTP code.

## Files Touched
- `src/controllers/auth/index.ts`
- `src/routes/auth/auth.ts`
- `src/utils/mfa.ts`
- `package.json` (deps)
- Swagger JSDoc inside `src/routes/auth/auth.ts`

## New/Updated Endpoints (Contracts)

- `POST /auth/login`
  - If 2FA disabled → returns `{ success, message, data: { token, user } }`.
  - If 2FA enabled → returns `{ success, message: "MFA required", data: { mfaRequired: true, mfaTempToken } }` (no JWT).

- `POST /auth/mfa/verify`
  - Request: `{ code, mfaTempToken }`
  - Response: `{ success, message, data: { token, user } }`
  - Notes: `code` can be a 6-digit TOTP or a recovery code.

- `POST /auth/mfa/setup/start` (Auth)
  - Response base: `{ secret, otpauthUrl, qrCodeDataUrl? }`
  - Option A extension: returns `enrollmentToken` (single-use, short-lived) to allow code-less setup confirmation.

- `POST /auth/mfa/setup/confirm` (Auth)
  - Accepts EITHER `{ code }` OR `{ enrollmentToken }` (Option A) to enable 2FA.
  - Response: `{ success, message: "2FA enabled", data: { recoveryCodes: string[] } }`

- `GET /auth/mfa/recovery-codes` (Auth)
  - Regenerates and returns fresh recovery codes.

- `POST /auth/mfa/disable` (Auth)
  - Disables 2FA for the current user.

## Frontend Flow Implications

- Login (`src/pages/auth/Login.tsx`):
  - If `mfaRequired`, show 2FA step and pass `{ code, mfaTempToken }` to `/auth/mfa/verify`.

- Profile (`src/pages/Profile.tsx`):
  - Start setup calls `/auth/mfa/setup/start` and displays QR/secret.
  - Confirm setup:
    - Code path: send `{ code }` to `/auth/mfa/setup/confirm`.
    - Option A: send `{ enrollmentToken }` from setup/start to `/auth/mfa/setup/confirm` without code entry.
  - View/regenerate recovery codes via `/auth/mfa/recovery-codes`.
  - Disable via `/auth/mfa/disable`.

## Data Model Notes
- `User` has `twoFactorEnabled: boolean` and `twoFactorSecret: string | null`.
- Recovery codes are currently stored in-memory (hashed) in the API process. They are returned in plaintext only at setup confirm (and on regeneration). Persistence to DB can be added later.

## Libraries and Config
- Added deps: `otplib` (TOTP), `qrcode` (QR generation).
- Optional env:
  - `TOTP_QR=true` to include `qrCodeDataUrl`.
  - `TOTP_LABEL` issuer label (default: `Caritas`).

## Swagger
- Swagger JSDoc added/updated in `src/routes/auth/auth.ts` for all MFA endpoints, including Option A `enrollmentToken`.

## Auditing
- `AuditLog` entries added for: setup start, setup confirm, MFA verify success/failure, recovery codes regenerate, disable.

## Compatibility / Breaking Changes
- No breaking changes to existing login without 2FA.
- New behaviors only apply when `twoFactorEnabled=true`.

## Testing Checklist
- Login with and without 2FA (ensure no JWT is returned with `mfaRequired`).
- Setup via code path and via Option A `enrollmentToken` path.
- Verify MFA step with both a TOTP and a recovery code.
- Regenerate recovery codes and disable 2FA.

## Follow-ups (Optional)
- Persist recovery codes (hashed) in DB.
- Add rate limiting for `/auth/login` and `/auth/mfa/verify`.
- Expand Swagger component schemas if needed.
