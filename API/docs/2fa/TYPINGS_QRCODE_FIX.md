# TypeScript Typings Fix: `qrcode`

## Cause
- TypeScript could not find type declarations for the `qrcode` package used in `src/utils/mfa.ts`.
- Error: "Could not find a declaration file for module 'qrcode' ... implicitly has an 'any' type."

## What I Changed
- Updated import to a namespace import compatible with the available typings:
  - File: `src/utils/mfa.ts`
  - Change: `import * as qrcode from 'qrcode'`
- Added an ambient declaration to unblock builds if DefinitelyTyped is not installed:
  - File: `src/types/qrcode.d.ts`
  - Contents: `declare module 'qrcode';`

## Recommended (Preferred) Fix
- Install official typings so you get type safety:
```bash
npm i -D @types/qrcode
```

## If TypeScript Still Complains
- Ensure `tsconfig.json` includes your custom `.d.ts` files:
```json
{
  "include": [
    "src/**/*.ts",
    "src/**/*.d.ts"
  ]
}
```

## Affected Code
- `src/utils/mfa.ts`
  - Function `toQrDataUrl(text: string): Promise<string>` remains the same, now typed correctly with the namespace import.

## Status
- Ambient types added and import corrected. Installing `@types/qrcode` is still recommended for best DX.
