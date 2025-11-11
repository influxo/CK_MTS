# Testing Plan for TOTP 2FA (Frontend)

## Scope
Covers unit-level integration (Redux + service) and manual E2E scenarios across login and profile 2FA management.

## Preconditions
- Backend exposes endpoints defined in `docs/2fa/api_contracts.md`.
- A user account with and without 2FA enabled.

## Test Matrix
- **Login without 2FA**
  - Enter valid credentials → authenticated, token stored, `Authorization` header set.
  - Invalid credentials → error shown, no token stored.
- **Login with 2FA enabled**
  - Step 1: valid credentials → `mfaRequired` state set, no token stored.
  - Step 2: valid 6-digit code → authenticated, token stored.
  - Step 2: invalid code → inline error, remains on code step.
- **2FA Setup (Profile)**
  - Start setup: QR or otpauth URL + secret displayed.
  - Confirm with valid code → 2FA enabled, recovery codes may display, profile refresh shows enabled.
  - Confirm with invalid code → error shown.
  - Cancel setup → clears setup info.
- **Recovery Codes**
  - View recovery codes → codes listed.
  - Retry on error → shows error.
- **Disable 2FA**
  - Disable → profile refresh shows disabled.
  - Error path → shows error.

## Notes
- Ensure no JWT is stored on `mfaRequired` responses.
- Numeric input constraints: `inputMode="numeric"`, `pattern="\\d*"`, `maxLength=6`.
- Accessibility: Buttons and inputs have clear labels.
- i18n: Fallback strings are provided when keys are missing.
