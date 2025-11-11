# Frontend Progress: TOTP 2FA (Authenticator App)

## Summary
- Implemented TOTP 2FA end-to-end on the frontend with Option A (code-less confirm via `enrollmentToken`) and a fallback manual code path.
- Added a modal in Profile to show QR and automatically enable 2FA after scanning (backend must provide `qrCodeDataUrl` and `enrollmentToken`).
- Added Redux/thunks and services to support MFA challenge during login and 2FA lifecycle management.

## Changes (Files)
- `src/services/auth/authModels.ts`
  - `LoginResponse.data`: `mfaRequired?`, `mfaTempToken?`.
  - `StartTotpSetupResponse.data`: `secret`, `otpauthUrl`, `qrCodeDataUrl?`, `enrollmentToken?`.
  - `ConfirmTotpSetupRequest`: `{ code?: string; enrollmentToken?: string }`.
- `src/services/auth/authService.ts`
  - `login()` respects `mfaRequired` (no token stored until verified).
  - New: `verifyTotp()`, `startTotpSetup()`, `confirmTotpSetup()`, `getRecoveryCodes()`, `disableTotp()`.
- `src/store/slices/authSlice.ts`
  - State: `mfaRequired`, `mfaTempToken`.
  - Thunk: `verifyTotp` + extraReducers for MFA flow.
  - Selectors for MFA state.
- `src/hooks/useAuth.ts`
  - Exposes `mfaRequired`, `mfaTempToken`, `verifyTotpCode()`.
- `src/pages/auth/Login.tsx`
  - Two-step login: shows TOTP code field when `mfaRequired`.
- `src/pages/Profile.tsx`
  - Security tab: "Enable 2FA" opens modal (Dialog) with QR.
  - Auto-enable: polls `confirmTotpSetup({ enrollmentToken })` after QR display until success/timeout (~40s).
  - Fallback: shows a single 6‑digit code input if no `enrollmentToken`.
  - Manage: disable 2FA, view recovery codes.

## Current UX (Profile)
1. Click "Enable 2FA" → modal opens.
2. FE calls `startTotpSetup()` and shows:
   - `qrCodeDataUrl` (image) OR `otpauthUrl`/`secret` text fallback.
   - If `enrollmentToken` exists → FE attempts `confirmTotpSetup({ enrollmentToken })` after a short delay and polls until enabled.
   - If not, user can enter a 6‑digit code and click Confirm.
3. On success, FE refreshes profile and shows `twoFactorEnabled: true` and recovery codes (once).

## Pending Backend Tasks
- **Return QR image**: `POST /auth/mfa/setup/start` must include `data.qrCodeDataUrl` (PNG data URL of the otpauth URI).
- **Return enrollment token**: Include `data.enrollmentToken` (single-use, short-lived, user-bound) in `setup/start`.
- **Accept enrollment token**: `POST /auth/mfa/setup/confirm` must accept `{ enrollmentToken }` to enable 2FA without code.
- **Recovery codes policy** (optional improvement):
  - Only return plaintext codes on setup confirm and explicit regeneration.
  - Separate endpoints: `GET /auth/mfa/recovery-codes` (masked/remaining), `POST /auth/mfa/recovery-codes/regenerate` (new plaintext list).

## Testing Checklist (FE)
- Login with/without 2FA: MFA challenge works; token stored only after verification.
- Profile → Enable 2FA: QR appears; auto-enable succeeds when backend provides `enrollmentToken`.
- Fallback: Without `enrollmentToken`, manual 6‑digit confirm works.
- Disable 2FA and re-enable.

## Known Considerations
- Auto-enable relies on backend returning both `qrCodeDataUrl` and `enrollmentToken`.
- If backend doesn’t provide those, FE gracefully falls back to manual code entry.

## Next Steps
- Backend confirms Option A changes are live.
- FE quick smoke test with Network tab to verify `setup/start` payload and auto-enable polling.
