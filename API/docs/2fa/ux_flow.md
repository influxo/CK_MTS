# UX Flow for TOTP 2FA

## Login
- **Step 1:** User enters email and password on `src/pages/auth/Login.tsx`.
- **Backend outcome:**
  - If MFA not enabled: returns `{ token, user }` and user is authenticated.
  - If MFA enabled: returns `{ mfaRequired: true, mfaTempToken }`.
- **Step 2 (if required):** UI prompts for a 6-digit code. On success, the final `{ token, user }` is returned and stored.

## Profile 2FA Management
- **Start setup:** User clicks Start in `src/pages/Profile.tsx` → `startTotpSetup()` shows QR/secret.
- **Confirm setup:** User enters a valid 6-digit code → `confirmTotpSetup()` → 2FA enabled; recovery codes may be returned.
- **View recovery codes:** `getRecoveryCodes()` and display list.
- **Disable 2FA:** `disableTotp()` then refresh profile.

## UX Considerations
- **Error handling:** Inline, concise messages for setup and verification steps.
- **Accessibility:** Numeric input with `inputMode="numeric"`, `pattern="\\d*"`, maxLength=6.
- **Security:** No 2FA secret generation on FE; display only what backend provides.
- **Resilience:** If QR image is not provided, show `otpauthUrl` and secret as text.
