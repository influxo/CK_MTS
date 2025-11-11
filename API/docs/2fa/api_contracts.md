# API Contracts (Frontend Expectations)

All endpoints are under `/auth` base path.

- Login: `POST /auth/login`
  - Request: `{ email, password }`
  - Response:
    - Success without MFA: `{ success, message, data: { token, user } }`
    - Success with MFA required: `{ success, message, data: { mfaRequired: true, mfaTempToken } }`

- Verify TOTP to complete login: `POST /auth/mfa/verify`
  - Request: `{ code, mfaTempToken }`
  - Response: `{ success, message, data: { token, user } }`

- Start TOTP setup: `POST /auth/mfa/setup/start`
  - Auth: Bearer token
  - Response: `{ success, message, data: { secret, otpauthUrl, qrCodeDataUrl? } }`

- Confirm TOTP setup: `POST /auth/mfa/setup/confirm`
  - Auth: Bearer token
  - Request: `{ code }`
  - Response: `{ success, message, data?: { recoveryCodes?: string[] } }`

- Get recovery codes: `GET /auth/mfa/recovery-codes`
  - Auth: Bearer token
  - Response: `{ success, message, data: { recoveryCodes: string[] } }`

- Disable TOTP: `POST /auth/mfa/disable`
  - Auth: Bearer token
  - Response: `{ success, message }`

Notes:
- Backend should not return JWT on `/auth/login` when `mfaRequired` is true.
- Frontend stores token only on responses containing a real `token` (login without MFA or after successful `/mfa/verify`).
- `qrCodeDataUrl` is optional; if omitted, frontend shows `otpauthUrl`.
