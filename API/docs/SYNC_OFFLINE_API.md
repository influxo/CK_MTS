# Offline Sync API Guide

- **Audience**: Frontend engineers building offline-first features
- **Endpoints**: `GET /sync/full`, `POST /sync/upload`
- **Auth**: Bearer JWT (same as the rest of the API)
- **RBAC**: All data is scoped by the authenticated user's permissions (`allowedProgramIds`)

---

## Overview

- **/sync/full** returns a SQLite database snapshot containing the user's RBAC-scoped data for offline use.
- **/sync/upload** accepts queued offline mutations (create/update/delete) and applies them server-side using existing business rules.

This guide explains request/response formats, typical flows, error handling, and data shapes included in the SQLite export.

---

## GET /sync/full

- **Purpose**: Download a full offline snapshot (SQLite) of the user's accessible data.
- **Method**: GET
- **Auth**: `Authorization: Bearer <JWT>`
- **Response**: `200 OK`, `Content-Type: application/octet-stream`, binary SQLite file

### Request

- No body
- Example (curl):
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  -X GET http://<host>:<port>/sync/full \
  -o snapshot.sqlite
```

### Response
- Binary payload: SQLite database file
- Filename (header): `Content-Disposition: attachment; filename="sync_<timestamp>.sqlite"`

### Included data (SQLite tables)
The snapshot mirrors a subset of server tables. Current v1 schema:

- `projects(id, name, description, category, status, createdAt, updatedAt)`
- `subprojects(id, projectId, name, description, category, status, createdAt, updatedAt)`
- `activities(id, subprojectId, name, description, category, frequency, reportingFields, status, createdAt, updatedAt)`
- `users(id, firstName, lastName, email, status, createdAt, updatedAt)`
- `project_users(id, projectId, userId, createdAt, updatedAt)`
- `subproject_users(id, subprojectId, userId, createdAt, updatedAt)`
- `form_templates(id, name, schema, version, status, includeBeneficiaries, createdAt, updatedAt)`
- `form_entity_associations(id, formTemplateId, entityId, entityType, createdAt, updatedAt)`
- `services(id, name, description, category, status, createdAt, updatedAt)`
- `service_assignments(id, serviceId, entityId, entityType, createdAt, updatedAt)`
- `beneficiaries(id, pseudonym, status, createdAt, updatedAt, firstNameEnc, lastNameEnc, dobEnc, genderEnc, addressEnc, municipalityEnc, nationalityEnc, nationalIdEnc, phoneEnc, emailEnc, ethnicityEnc, residenceEnc, householdMembersEnc)`

Notes:
- **RBAC**: All rows are filtered to projects in the user's `allowedProgramIds`. Subprojects and activities are filtered transitively. Beneficiaries are filtered via `BeneficiaryAssignment` linking them to allowed projects/subprojects.
- **PII**: Only encrypted PII is stored in the SQLite (`*_Enc` JSON). No plaintext PII.
- **Types**: Timestamps stored as ISO strings. `reportingFields` and form `schema` are JSON serialized as text.

### Error codes
- `401/403`: Missing or invalid token, or forbidden.
- `501`: Snapshot generation not available (server missing native dependency). Body example:
```json
{
  "success": false,
  "message": "SQLite snapshot not available on this server. Missing better-sqlite3 dependency.",
  "hint": "Install better-sqlite3 and use Node 20/22 LTS for prebuilt binaries."
}
```
- `500`: Unexpected server error.

### Client handling tips
- Always verify the file is a valid SQLite database before replacing the local cache.
- Keep a local mapping of the snapshot version time (e.g., file name timestamp) for debugging.
- If `501`, continue using online JSON endpoints or retry later.

---

## POST /sync/upload

- **Purpose**: Push queued offline mutations back to the server.
- **Method**: POST
- **Auth**: `Authorization: Bearer <JWT>`
- **Request**: JSON body `{ mutations: Change[] }`
- **Response**: JSON with per-mutation results

### Request body
```json
{
  "mutations": [
    {
      "clientMutationId": "uuid-1",
      "method": "POST",
      "endpoint": "/forms/templates/<TEMPLATE_ID>/responses",
      "entityType": "formSubmission",
      "data": {
        "templateId": "<TEMPLATE_ID>",
        "entityId": "<entity-uuid>",
        "entityType": "project|subproject|activity",
        "submittedAt": "2025-10-13T10:00:00.000Z",
        "latitude": 12.3456,
        "longitude": 78.9012,
        "data": { "fieldA": "value", "fieldB": 123 },
        "beneficiaryId": "<optional-beneficiary-uuid>",
        "services": [
          {
            "serviceId": "<service-uuid>",
            "staffUserId": "<optional-user-uuid>",
            "deliveredAt": "2025-10-13T10:05:00.000Z",
            "notes": "optional"
          }
        ]
      }
    },
    {
      "clientMutationId": "uuid-2",
      "method": "POST",
      "endpoint": "/beneficiaries",
      "entityType": "beneficiary",
      "data": {
        "pseudonym": "BNF-12345",
        "pii": {
          "firstName": "Jane",
          "lastName": "Doe",
          "dob": "1990-01-01",
          "gender": "F",
          "address": "...",
          "municipality": "...",
          "nationality": "...",
          "nationalId": "...",
          "phone": "...",
          "email": "...",
          "ethnicity": "...",
          "residence": "...",
          "householdMembers": 4
        }
      }
    },
    {
      "clientMutationId": "uuid-3",
      "method": "PUT",
      "endpoint": "/beneficiaries/<BEN_ID>",
      "entityType": "beneficiary",
      "data": { "status": "active" }
    },
    {
      "clientMutationId": "uuid-4",
      "method": "DELETE",
      "endpoint": "/beneficiaries/<BEN_ID>",
      "entityType": "beneficiary",
      "data": {}
    }
  ]
}
```

### Supported mutation patterns (v1)
- **Form submission**:
  - `method: POST`, `endpoint: /forms/templates/{templateId}/responses` or `entityType: "formSubmission"` with `data.templateId`.
  - Must include `entityId` and `entityType` (`project|subproject|activity`).
  - Optional `beneficiaryId`. If present, must exist.
  - Optional `services[]`: deliveries created if the service is assigned at the correct scope (project/subproject) or allowed by relaxed policy.
- **Beneficiary create**:
  - `POST /beneficiaries` with `data` per beneficiaries service (PII provided in plaintext; backend encrypts).
- **Beneficiary update**:
  - `PUT /beneficiaries/{id}` with partial fields.
- **Beneficiary delete (soft)**:
  - `DELETE /beneficiaries/{id}` → sets `status=inactive`.

Other mutation types will be ignored with `status: "ignored"` until added.

### Response body
```json
{
  "success": true,
  "results": [
    { "clientMutationId": "uuid-1", "status": "applied", "entityType": "formSubmission", "serverId": "<new-response-id>" },
    { "clientMutationId": "uuid-2", "status": "applied", "entityType": "beneficiary", "serverId": "<id>" },
    { "clientMutationId": "uuid-3", "status": "applied", "entityType": "beneficiary", "serverId": "<id>" },
    { "clientMutationId": "uuid-4", "status": "applied", "entityType": "beneficiary", "serverId": "<id>" }
  ]
}
```

### Per-mutation status
- **`applied`**: Change accepted and committed.
- **`error`**: Change rejected. Includes `error` message.
- **`ignored`**: Unrecognized mutation type; no action taken.

### Error scenarios
- **Validation errors**: Form schema validation fails → `status: "error"` per mutation.
- **RBAC violations**: Entity outside user scope → `status: "error"` per mutation.
- **Missing association**: Form template not associated to the `entityId/entityType` → `status: "error"`.

### Idempotency & conflict notes
- The backend does not currently dedupe `clientMutationId`; the client should ensure unique IDs to correlate results.
- If a network retry occurs, duplicate creates may result. The client should guard against re-sending already applied mutations.
- Conflict policy for other entities will be expanded in future versions.

### Example (curl)
```bash
curl -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d @mutations.json \
  http://<host>:<port>/sync/upload
```

### Example (TypeScript fetch)
```ts
async function uploadMutations(mutations: any[]) {
  const res = await fetch(`/sync/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mutations }),
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const json = await res.json();
  return json.results;
}
```

---

## Typical Offline Flow

1. **Initial download**: Call `/sync/full` and hydrate the local DB from the SQLite file.
2. **Work offline**: Queue user actions locally as `mutations[]` (ensure unique `clientMutationId`).
3. **Reconnect**: POST the queued `mutations` to `/sync/upload`.
4. **Reconcile**: Inspect results; retry or adjust UI based on `applied/error/ignored` statuses.

Optional future enhancement: incremental deltas endpoint for smaller syncs.

---

## Security & Privacy

- **Auth**: JWT required.
- **RBAC**: Strictly enforced for all entities by server.
- **PII**: No plaintext PII in the SQLite. Only encrypted fields are stored.

---

## Notes for Mobile/Desktop Clients

- Use a stable local SQLite engine (e.g., SQL.js in the browser, or platform SQLite on mobile/desktop) to import/merge the snapshot.
- Large exports: consider a progress UI and run import in a Worker to avoid blocking the main thread.
- Always validate the downloaded file (e.g., open pragma query) before replacing the local store.

---

## Versioning & Compatibility

- API is versioned implicitly with the backend release. The SQLite schema may expand in future versions.
- The client can detect schema by introspecting `sqlite_master` or checking table presence.

---

## References

- Routes: `src/routes/sync/sync.ts`
- Controller: `src/controllers/sync/index.ts` (`full`, `upload`)
- Models/associations: `src/models/index.ts`
