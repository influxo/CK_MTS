# Frontend Update (2025-10-18): Enforce QR Scan + Manual Code Confirm

## Summary
- Changed Profile 2FA modal to require manual 6‑digit code entry after scanning the QR.
- Removed any auto-enable attempts with `enrollmentToken`.
- Reason: Backend currently returns no `qrCodeDataUrl` and requirements specify enabling only after scanning and entering the code.

## Files Changed
- `src/pages/Profile.tsx`
  - Removed auto-enable polling logic entirely.
  - Modal copy updated: "Scan the QR … then enter the 6‑digit code to enable 2FA."
  - Always renders code entry when `setupInfo` is present.
  - Continues to show QR if `qrCodeDataUrl` exists; otherwise shows `otpauthUrl`/`secret` text fallback.

## Current Flow (Profile → Enable 2FA)
1. Click "Enable 2FA" → opens modal.
2. FE calls `POST /auth/mfa/setup/start` and displays:
   - `qrCodeDataUrl` image if provided, else `otpauthUrl` + `secret` (text fallback).
3. User scans QR in authenticator app.
4. User types the 6‑digit TOTP code into the modal and clicks Confirm.
5. FE calls `POST /auth/mfa/setup/confirm` with `{ code }`.
6. On success: profile refresh; 2FA enabled; recovery codes displayed once.

## Backend Notes
- If you want the modal to render an actual QR image, ensure `setup/start` returns `data.qrCodeDataUrl` (see `docs/2fa/QR_DISPLAY_TROUBLESHOOT.md`).
- If you later want code-less confirm (Option A), FE can be re-enabled to use `enrollmentToken`, but for now it is intentionally disabled to meet the requirement.

## Test Checklist
- Start setup: modal shows QR (or otpauth text) and code input.
- Enter valid 6‑digit code → confirm enables 2FA; recovery codes shown once.
- Enter invalid code → inline error shown; remains in modal.
- Disable 2FA and re-enable.
- Login flow: `mfaRequired` handled and TOTP step completes successfully.
