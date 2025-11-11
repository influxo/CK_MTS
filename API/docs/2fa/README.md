# TOTP 2FA Integration (Frontend)

This folder documents the frontend implementation of Time-based One-Time Password (TOTP) 2FA using an authenticator app (e.g., Google Authenticator, Microsoft Authenticator).

- Auth service code: `src/services/auth/authService.ts`
- Redux slice: `src/store/slices/authSlice.ts`
- Hook: `src/hooks/useAuth.ts`
- Login flow UI: `src/pages/auth/Login.tsx`
- Profile 2FA management UI: `src/pages/Profile.tsx`

## Goals
- Add a production-ready 2FA flow using TOTP authenticator apps.
- Do not break existing login and profile flows.
- Keep all secrets handled by the backend. The frontend only displays secrets/QR provided by API during setup.

## Status
- Login supports MFA challenge with TOTP.
- Profile screen supports setup (QR/secret), confirmation, recovery codes, and disable.
- API contracts aligned with `authModels.ts`.

## Overview
1. User logs in with email + password.
2. If backend indicates `mfaRequired`, UI shows a second step for TOTP code entry. On success, the real JWT is stored.
3. Users can enable/disable 2FA and manage recovery codes from Profile.

See:
- `api_contracts.md`
- `ux_flow.md`
- `testing_plan.md`
- Progress log in this file.

## Progress Log
- Implemented models for MFA responses/requests in `authModels.ts`.
- Modified `authService.login()` to respect `mfaRequired` and avoid storing token prematurely.
- Added `verifyTotp`, `startTotpSetup`, `confirmTotpSetup`, `getRecoveryCodes`, `disableTotp` in `authService`.
- Extended Redux slice with `mfaRequired` and `mfaTempToken`, plus `verifyTotp` thunk.
- Updated `useAuth` to expose MFA state and a `verifyTotpCode()` helper.
- Updated `Login.tsx` to include the 2FA challenge step.
- Extended `Profile.tsx` security tab to manage 2FA lifecycle.
