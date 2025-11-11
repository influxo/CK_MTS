# 2FA (TOTP) Progress Summary

- **[scope]** This summarizes 2FA progress across FE and BE. See `docs/2fa/BACKEND_PROGRESS.md` and `docs/2fa/README.md` for detailed logs.

## Current Status
- **[frontend]** Implemented login MFA step and Profile 2FA management per `docs/2fa/README.md`.
- **[backend]** Implemented endpoints and logic per `docs/2fa/api_contracts.md`:
  - `POST /auth/login` returns `{ mfaRequired, mfaTempToken }` when 2FA is enabled.
  - `POST /auth/mfa/verify` finalizes login with TOTP or recovery code.
  - `POST /auth/mfa/setup/start`, `POST /auth/mfa/setup/confirm`, `GET /auth/mfa/recovery-codes`, `POST /auth/mfa/disable` for lifecycle.
- **[default]** Users do NOT have 2FA enabled by default (`twoFactorEnabled=false`). They must enable it from the Profile flow.

## How a User Enables 2FA
1. Go to Profile → Security and click Start setup.
2. Backend returns `{ secret, otpauthUrl, qrCodeDataUrl? }`.
3. Scan with an authenticator app and generate a 6-digit code.
4. Confirm code via `POST /auth/mfa/setup/confirm`.
5. Backend enables 2FA and returns recovery codes (store safely).

## Login Flow Once Enabled
- Step 1: `POST /auth/login` → returns `{ mfaRequired: true, mfaTempToken }`.
- Step 2: `POST /auth/mfa/verify` with the 6-digit code → returns `{ token, user }`.

## Known Gaps
- Recovery codes are in-memory only; persistence (hashed at rest) recommended.
- Rate limiting and auditing not added yet.
- Swagger docs need to be extended for new endpoints.

## References
- `docs/2fa/README.md`
- `docs/2fa/BACKEND_PROGRESS.md`
- `docs/2fa/api_contracts.md`
- `docs/2fa/testing_plan.md`
- `docs/2fa/ux_flow.md`
