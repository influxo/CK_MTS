# Backend Changes: Code-less 2FA Enablement (Option A)

This document specifies the additional backend behavior to support enabling TOTP 2FA from a modal with only a QR code (no code entry). It extends the existing contracts defined in `docs/2fa/backend_requirements.md` and `docs/2fa/api_contracts.md`.

The core change: introduce a one-time `enrollmentToken` returned by `setup/start`, and allow `setup/confirm` to accept `enrollmentToken` (without a TOTP code) to enable 2FA.

## Summary of Changes
- `POST /auth/mfa/setup/start` → add `enrollmentToken` to response `data`.
- `POST /auth/mfa/setup/confirm` → accept either `{ code }` (current behavior) OR `{ enrollmentToken }` to enable 2FA.
- Keep all other endpoints, response shapes, and behaviors unchanged.

---

## Endpoints

### 1) POST /auth/mfa/setup/start (Auth: Bearer JWT)
Purpose: Begin TOTP setup and return data for the FE modal (QR image or otpauth URL, secret) plus a one-time token to allow code-less confirmation.

Response (extended)
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "secret": "BASE32SECRET",
    "otpauthUrl": "otpauth://totp/App:email?secret=BASE32SECRET&issuer=App&digits=6&period=30&algorithm=SHA1",
    "qrCodeDataUrl": "data:image/png;base64,...", // optional
    "enrollmentToken": "<opaque-one-time-token>"
  }
}
```
Implementation notes
- Generate a brand-new TOTP secret and associate it with the user in a "pending setup" state.
- Generate a random, opaque `enrollmentToken` (short TTL, e.g., 5–10 minutes). Store it server-side alongside the pending secret and the user ID.
- `qrCodeDataUrl` is optional; if omitted, the FE shows `otpauthUrl` and `secret` as text.

### 2) POST /auth/mfa/setup/confirm (Auth: Bearer JWT)
Purpose: Complete setup and enable 2FA. Support two request bodies:
- Existing behavior:
```json
{ "code": "123456" }
```
- New code-less behavior:
```json
{ "enrollmentToken": "<opaque-one-time-token>" }
```
Response (unchanged)
```json
{
  "success": true,
  "message": "2FA enabled",
  "data": { "recoveryCodes": ["ABCD-EFGH", "IJKL-MNOP"] }
}
```
Validation rules
- If `{ code }` is provided, verify against the pending secret; on success, finalize and enable 2FA.
- If `{ enrollmentToken }` is provided, validate that the token:
  - Exists, is unexpired, belongs to the authenticated user, and matches a pending secret.
  - Has not been used before (single-use).
  - On success, finalize and enable 2FA without requiring a TOTP code.
- Return appropriate errors for expired/invalid tokens or missing pending setup.
- Always return recovery codes on success.

---

## Security Considerations
- **Short TTL**: `enrollmentToken` must expire quickly (e.g., 5–10 minutes).
- **Single-use**: Invalidate the token immediately upon successful confirmation.
- **User binding**: Token must be bound to the authenticated user and the pending secret.
- **Transport**: Only return `enrollmentToken` over HTTPS.
- **Auditing**: Log token creation and confirmation events (no sensitive values).
- **Secret handling**: Pending secret should be stored securely (encrypted at rest). After confirmation, persist the final secret and clear pending data.
- **Recovery codes**: Generate 8–10 one-time codes, store hashed, return plaintext only in the confirmation response.

---

## Error Responses (Examples)
- 400 `{"success": false, "message": "Setup not started"}`
- 400 `{"success": false, "message": "Invalid enrollment token"}`
- 410 `{"success": false, "message": "Enrollment token expired"}`
- 409 `{"success": false, "message": "2FA already enabled"}`

---

## Frontend Expectations (Profile Modal)
- Call `POST /auth/mfa/setup/start` when opening the modal; display the QR (or `otpauthUrl`/`secret`).
- On auto-enable (no code field): call `POST /auth/mfa/setup/confirm` with `{ enrollmentToken }` to finalize.
- Refresh profile to show `twoFactorEnabled: true` and optionally display recovery codes from the response.

## Compatibility
- Existing clients using `{ code }` continue to work (no breaking change).
- New FE modal takes advantage of `{ enrollmentToken }` to enable without code entry.
