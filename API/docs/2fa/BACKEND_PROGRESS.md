# 2FA (TOTP) Backend Progress

## Summary
- Implemented TOTP 2FA flow aligned with `docs/2fa/api_contracts.md`.
- Users are NOT 2FA-enabled by default. They must enable it from the Profile flow.
- Added endpoints and utilities to support setup, verification, recovery codes, and disable.

## What Changed
- Added `src/utils/mfa.ts` for TOTP, QR, temp tokens, and recovery codes (in-memory for now).
- Updated `src/controllers/auth/index.ts`:
  - `login()` returns `{ mfaRequired, mfaTempToken }` when `twoFactorEnabled` is true (no JWT then).
  - New: `verifyMfa()`, `startTotpSetup()`, `confirmTotpSetup()`, `getRecoveryCodes()`, `disableTotp()`.
- Updated routes in `src/routes/auth/auth.ts` to expose new endpoints.
- Added deps in `package.json`: `otplib`, `qrcode`.

## Endpoints (ready)
- `POST /auth/login`
  - If user has 2FA disabled → returns `{ token, user }`.
  - If user has 2FA enabled → returns `{ mfaRequired: true, mfaTempToken }` (no JWT yet).
- `POST /auth/mfa/verify` → `{ code, mfaTempToken }` → returns `{ token, user }` on success.
- `POST /auth/mfa/setup/start` (auth) → returns `{ secret, otpauthUrl, qrCodeDataUrl? }`.
- `POST /auth/mfa/setup/confirm` (auth) → returns `{ recoveryCodes: string[] }` and enables 2FA for the user.
- `GET /auth/mfa/recovery-codes` (auth) → regenerates and returns fresh codes.
- `POST /auth/mfa/disable` (auth) → disables 2FA.

## Enable/Disable Behavior
- Default: `twoFactorEnabled = false` (see `src/models/User.ts`).
- To enable:
  1. Call `POST /auth/mfa/setup/start` and show QR/secret.
  2. Scan and generate a 6-digit TOTP.
  3. Call `POST /auth/mfa/setup/confirm` with the code → backend stores secret and returns recovery codes.
- To use at login (after enabling):
  - `POST /auth/login` → `{ mfaRequired, mfaTempToken }`, then `POST /auth/mfa/verify` with TOTP code.
- To disable:
  - `POST /auth/mfa/disable` (auth).

## Current Limitations
- Recovery codes are stored in-memory for now (not persisted). Recommended to store hashed in DB.
- Rate limiting and auditing for MFA flows not added yet.
- Swagger docs for new endpoints not added yet.

## Next Steps
- Persist recovery codes (hashed) in DB and support consumption/regeneration.
- Add rate limiting to `/auth/login` and `/auth/mfa/verify`.
- Add audit logs for enable/disable/verify/regenerate events.
- Add Swagger documentation for all new endpoints.

## Verification Pointers
- Confirm frontend flows follow `docs/2fa/ux_flow.md` and `docs/2fa/testing_plan.md`.
- Ensure no JWT is stored by frontend when `{ mfaRequired: true }` is returned by `/auth/login`.
- Optional: set `TOTP_QR=true` to include `qrCodeDataUrl` in setup start response.
