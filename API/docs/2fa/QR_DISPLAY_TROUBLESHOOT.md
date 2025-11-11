# QR Display Troubleshoot (Frontend/Backend)

## Findings
- The modal in `src/pages/Profile.tsx` shows a QR image only when `startTotpSetup()` returns `data.qrCodeDataUrl`.
- Current response contains `otpauthUrl` and `secret` but not `qrCodeDataUrl`, so the UI falls back to showing the otpauth URL as text.
- Backend docs (`FE_TASKS_STATUS.md`) say QR image support is implemented behind `TOTP_QR=true` (env flag).

## Required Backend Setting
- Ensure the backend environment has:
```
TOTP_QR=true
```
- And that `POST /auth/mfa/setup/start` returns:
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "secret": "BASE32SECRET",
    "otpauthUrl": "otpauth://...",
    "qrCodeDataUrl": "data:image/png;base64,...",
    "enrollmentToken": "<one-time-token>"
  }
}
```

## Frontend Behavior (already implemented)
- If `qrCodeDataUrl` exists → modal renders the QR image.
- If missing → modal shows `otpauthUrl` and `secret` as text (fallback).
- Auto-enable occurs only after QR is shown and only if `enrollmentToken` is returned (polling up to ~40s). Otherwise the fallback 6‑digit code input is shown.

## Optional Frontend Fallback (if we want QR without backend image)
- We can add a small client-side QR renderer (e.g., `qrcode` or `qrcode.react`) to generate the QR from `otpauthUrl` when `qrCodeDataUrl` is absent.
- Not required if backend consistently returns `qrCodeDataUrl`.

## Next Steps
- Backend: set `TOTP_QR=true` in the deployment environment and verify `qrCodeDataUrl` is included in `setup/start`.
- FE: No code changes needed; re-test the modal—QR should render as an image and auto-enable should proceed thereafter.
