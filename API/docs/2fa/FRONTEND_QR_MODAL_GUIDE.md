# Frontend QR Modal Integration Guide (TOTP 2FA Activation)

This guide explains how the frontend should open a QR modal to activate 2FA, leveraging Option A (code-less confirm via `enrollmentToken`) with a fallback to manual code entry.

## Endpoint Sequence
- Start setup (auth): `POST /auth/mfa/setup/start`
  - Returns: `{ secret, otpauthUrl, qrCodeDataUrl?, enrollmentToken }`
- Confirm setup (auth): `POST /auth/mfa/setup/confirm`
  - Accepts: `{ enrollmentToken }` (preferred, code-less) OR `{ code }` (manual)
  - Returns: `{ recoveryCodes: string[] }`

## UI Flow
1. **Trigger**: User clicks "Enable 2FA" in `Profile` security tab → call `startTotpSetup()`.
2. **Modal**: Open a QR modal that displays either:
   - `qrCodeDataUrl` if present, OR
   - A QR generated locally from `otpauthUrl` (frontend fallback), AND show the `secret` text.
3. **Auto-confirm (Option A)**: If `enrollmentToken` is returned, begin short polling:
   - Every 2–3s, call `confirmTotpSetup({ enrollmentToken })`.
   - Stop on success (200) or after timeout (~40s) and show manual code input as fallback.
4. **Fallback manual confirm**: If no `enrollmentToken` or polling times out, show a 6-digit numeric field and call `confirmTotpSetup({ code })` on submit.
5. **Success**: On confirm success:
   - Close modal.
   - Show recovery codes and allow user to copy/download.
   - Refresh profile to display `twoFactorEnabled = true`.

## Error Handling
- **Start setup** errors: show inline error toast and keep the security tab usable.
- **Auto-confirm** errors:
  - 401 Invalid/expired token → stop polling, switch to manual code.
  - Network errors → retry a few times; then show manual input.
- **Manual confirm** errors:
  - 401 Invalid code → show inline message, let user retry.
- **Accessibility**: Numeric input should use `inputMode="numeric"`, `pattern="\\d*"`, `maxLength=6`.

## State/Redux Hints
- Store `enrollmentToken`, `otpauthUrl`, `qrCodeDataUrl`, `secret` in a local modal state (not global) to avoid leaking secrets.
- When confirmation succeeds, dispatch a profile refresh/thunk to update `twoFactorEnabled`.

## Pseudocode (React)
```tsx
// On Enable 2FA click
const res = await authService.startTotpSetup();
setModal({
  open: true,
  qr: res.data.qrCodeDataUrl,
  otpauthUrl: res.data.otpauthUrl,
  secret: res.data.secret,
  enrollmentToken: res.data.enrollmentToken,
});

// In Modal effect: Option A polling
useEffect(() => {
  if (!modal.enrollmentToken) return;
  let cancelled = false;
  const startedAt = Date.now();
  async function tick() {
    if (cancelled) return;
    try {
      const ok = await authService.confirmTotpSetup({ enrollmentToken: modal.enrollmentToken });
      // Success → show recovery codes, close modal, refresh profile
      onConfirmed(ok.data.recoveryCodes);
      return;
    } catch (e: any) {
      // 401 or network → continue polling until timeout
    }
    if (Date.now() - startedAt < 40000) {
      setTimeout(tick, 2500);
    } else {
      // Timeout → show manual code input
      setShowManual(true);
    }
  }
  tick();
  return () => { cancelled = true; };
}, [modal.enrollmentToken]);

// Manual confirm submission
await authService.confirmTotpSetup({ code: sixDigit });
```

## Services Contracts (Type Hints)
```ts
// start
startTotpSetup(): Promise<{ data: { secret: string; otpauthUrl: string; qrCodeDataUrl?: string; enrollmentToken?: string } }>

// confirm
confirmTotpSetup(body: { code?: string; enrollmentToken?: string }): Promise<{ data: { recoveryCodes: string[] } }>
```

## Visual/UX Tips
- Provide clear copy: "Scan this QR with your authenticator app" + issuer name.
- Show the base32 `secret` under the QR for manual entry.
- After success, present recovery codes with copy and download options; warn they’re shown only once (unless regenerated).

## Backend Flags
- If `qrCodeDataUrl` is missing, FE should render a QR from `otpauthUrl` using a lightweight QR lib (or a simple `<img src="https://api.qrserver.com/v1/create-qr-code/?data=..." />` in dev).
- Enrollment token is single-use and time-limited; polling should timeout and fallback to manual entry.

## Testing
- Start+auto-confirm path: ensure modal auto-closes on success and profile reflects `twoFactorEnabled=true`.
- Fallback manual path: invalid code shows inline error; valid code enables 2FA.
- Regression: login still works without 2FA; with 2FA it returns `mfaRequired` and completes on `/auth/mfa/verify`.
```
