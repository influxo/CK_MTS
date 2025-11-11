# Frontend Tasks Mapping (Backend Status)

This document maps the frontend tasks listed in `docs/2fa/FRONTEND_PROGRESS.md` to current backend implementation status and notes.

## Pending Backend Tasks (from FE doc) and Status

- Return QR image in setup/start
  - Status: Implemented.
  - Details: `POST /auth/mfa/setup/start` returns `data.qrCodeDataUrl` when `TOTP_QR=true` (env flag). Always returns `otpauthUrl` and `secret` as fallback.
  - File: `src/controllers/auth/index.ts` (`startTotpSetup()`), `src/utils/mfa.ts` (`toQrDataUrl`).

- Return enrollment token in setup/start
  - Status: Implemented.
  - Details: `POST /auth/mfa/setup/start` returns `data.enrollmentToken` (single-use, ~10 min TTL, user-bound).
  - File: `src/controllers/auth/index.ts` (`startTotpSetup()`), `src/utils/mfa.ts` (`issueEnrollmentToken`).

- Accept enrollment token in setup/confirm
  - Status: Implemented.
  - Details: `POST /auth/mfa/setup/confirm` accepts `{ enrollmentToken }` (Option A) OR `{ code }` and enables 2FA.
  - File: `src/controllers/auth/index.ts` (`confirmTotpSetup()`), `src/utils/mfa.ts` (`consumeEnrollmentToken`).

- Recovery codes policy (optional improvement)
  - Current: `GET /auth/mfa/recovery-codes` regenerates and returns plaintext codes immediately.
  - Suggested by FE: split endpoints into:
    - `GET /auth/mfa/recovery-codes` → masked/remaining
    - `POST /auth/mfa/recovery-codes/regenerate` → returns new plaintext list
  - Status: Not implemented yet. Can implement upon confirmation.

## Additional Notes for FE

- Login MFA challenge
  - `POST /auth/login` returns `{ mfaRequired, mfaTempToken }` when 2FA is enabled.
  - `POST /auth/mfa/verify` accepts `{ code, mfaTempToken }` (TOTP or recovery code) and returns `{ token, user }`.

- Auditing
  - Audit logs are recorded for setup start/confirm, verify success/failure, recovery regenerate, and disable.

- Security & Config
  - `TOTP_QR=true` to include `qrCodeDataUrl` in setup/start response.
  - `TOTP_LABEL` to set issuer label in otpauth URL (default: `Caritas`).

## Quick FE Validation Checklist

- Call `/auth/mfa/setup/start` and confirm presence of:
  - `secret`, `otpauthUrl`, `qrCodeDataUrl?`, `enrollmentToken`
- Attempt Option A auto-enable by polling `/auth/mfa/setup/confirm` with `{ enrollmentToken }`.
- Fallback: Submit `{ code }` to `/auth/mfa/setup/confirm`.
- Verify login flow: challenge with `mfaRequired` and completion via `/auth/mfa/verify`.
