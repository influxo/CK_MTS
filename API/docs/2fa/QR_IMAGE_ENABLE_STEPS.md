# Ensure setup/start returns qrCodeDataUrl (QR Image)

## Steps (Backend)
- Set env flag in your runtime:
```
TOTP_QR=true
```
- Restart the API so the flag is picked up.
- The endpoint `POST /auth/mfa/setup/start` will include `data.qrCodeDataUrl` when this flag is true.

## Where It’s Implemented
- `src/controllers/auth/index.ts` → `startTotpSetup()`
  - Builds response `{ secret, otpauthUrl, qrCodeDataUrl?, enrollmentToken }`.
  - Adds `qrCodeDataUrl` when `process.env.TOTP_QR === 'true'` using `toQrDataUrl(otpauthUrl)`.
- `src/utils/mfa.ts`
  - `toQrDataUrl(text)` uses `qrcode.toDataURL` to generate a PNG data URL.

## Verify Locally
```bash
# Acquire a valid bearer token, then:
curl -s -H "Authorization: Bearer <token>" -X POST http://localhost:3000/auth/mfa/setup/start | jq
# Expect data.qrCodeDataUrl alongside secret + otpauthUrl
```

## Frontend Expectation
- When `qrCodeDataUrl` exists, `src/pages/Profile.tsx` should render it in the modal:
```tsx
<img src={setup.qrCodeDataUrl} alt="Authenticator QR" />
```
- If absent, FE shows `otpauthUrl` and `secret` text fallback.

## Common Pitfalls
- CSP blocks data URLs → add `img-src 'self' data:` in CSP.
- Missing flag in prod/stage → set `TOTP_QR=true` in the deployment environment.
- Very large images → the generated PNG is small, but you can style with fixed size (e.g., 192px) in the FE.

## Swagger (Reference)
- `src/routes/auth/auth.ts` includes docs for `/auth/mfa/setup/start` where `qrCodeDataUrl` is optional in the response.

## Notes
- `qrCodeDataUrl` is convenience; `otpauthUrl` and `secret` are always present for fallback.
- Option A `enrollmentToken` is also returned but currently unused by FE if manual code confirm is enforced.
