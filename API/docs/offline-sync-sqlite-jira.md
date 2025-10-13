# EPIC: Offline Sync via RBAC-scoped SQLite Snapshots

- **Key**: OFFLINE-EPIC-1
- **Owner**: Backend
- **Goal**: Enable offline-first frontend by serving a SQLite DB snapshot scoped by RBAC and accepting offline mutations for reconciliation.
- **Scope**: Backend API (`/sync/full`, `/sync/upload`), RBAC scoping, schema mirroring, conflict handling hooks, docs.

## Success Metrics
- **[metric]** Full snapshot generates in < 3s for typical user dataset.
- **[metric]** Upload applies valid mutations with 0 data loss and audit logs created.
- **[metric]** No plaintext PII in offline DB; only encrypted fields are present.

## Architecture Summary
- **[snapshot]** On demand GET `/sync/full` returns a binary SQLite DB. Data is filtered by RBAC (allowed programs) and mirrors core entities.
- **[upload]** POST `/sync/upload` accepts `{ mutations: Change[] }` and routes into existing `push()` logic for supported entities.
- **[compat]** Existing `/sync/pull` and `/sync/push` remain for backward compatibility.

## Technical Implementation
- **[controller]** `src/controllers/sync/index.ts`: added `full(req,res)` to build SQLite and `upload(req,res)` to map `mutations -> changes` and reuse `push()`.
- **[routes]** `src/routes/sync/sync.ts`: added `GET /sync/full`, `POST /sync/upload`.
- **[deps]** `better-sqlite3` added to `package.json` for synchronous SQLite creation.
- **[rbac]** Uses `req.user.allowedProgramIds` to scope `projects`, `subprojects`, `activities`, `formResponses`, `serviceDeliveries`, `assignments`, and beneficiaries via `BeneficiaryAssignment`.
- **[pii]** Offline DB stores only encrypted PII (`*_Enc` JSON) for `beneficiaries`.

## Data Model Mirrored in SQLite (v1)
- **[tables]**
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

## User Stories
- **[OFFLINE-1]** As a user, I can download a full offline DB so I can work without connectivity.
  - Acceptance: `GET /sync/full` returns HTTP 200 and a valid SQLite file. Data limited to my scope.
- **[OFFLINE-2]** As a user, my offline changes upload and reconcile on reconnect.
  - Acceptance: `POST /sync/upload` applies supported mutations; conflicts are reported per mutation with clear reasons.
- **[OFFLINE-3]** As a security officer, no plaintext PII is stored on devices.
  - Acceptance: Snapshot contains only encrypted PII; compliance reviewed.

## Tasks & Progress
- **[DONE] Add dependency**: Add `better-sqlite3` to `package.json`.
- **[PENDING INSTALL] Install deps**: Run `npm install` to fetch `better-sqlite3` (may download prebuilds or compile).
- **[DONE] Controller - full**: Implement `full()` to build SQLite snapshot with RBAC scoping.
- **[DONE] Controller - upload**: Implement `upload()` to map `mutations` to existing `push()`.
- **[DONE] Routes**: Add `GET /sync/full` and `POST /sync/upload` in `src/routes/sync/sync.ts`.
- **[DONE] RBAC Beneficiaries**: Scope beneficiaries by `BeneficiaryAssignment` polymorphic links.
- **[DONE] PII Policy**: Include only encrypted PII fields in `beneficiaries` table.
- **[TODO] Incremental sync**: Design `/sync/incremental` (deltas since `since`), add tombstones or `updatedAt` filtering per table.
- **[TODO] Conflict policy**: Finalize rule set per entity and return structured conflicts. Document on both ends.
- **[TODO] Frontend integration**: Wire download/save SQLite, local Dexie/SQLite engine, mutation queue to `/sync/upload` format.
- **[TODO] E2E tests**: Add tests covering snapshot validity, RBAC scoping, upload application, and audit logs.

## Risks & Mitigations
- **[perf]** Large snapshots may block event loop. Mitigate by background job or stream file creation (future).
- **[build]** `better-sqlite3` may require native build tools on Windows. Prefer prebuilt binaries; document prerequisites.
- **[pii]** Ensure no plaintext PII ever placed in SQLite. Review transformations regularly.

## Rollout Plan
- **[phase-1]** Ship `/sync/full` + `/sync/upload` behind role flag.
- **[phase-2]** Frontend pilot with small user group; monitor logs and timings.
- **[phase-3]** Add `/sync/incremental` and conflict UX.

## References (Code)
- **[controller]** `src/controllers/sync/index.ts` (`full`, `upload`, `push`)
- **[routes]** `src/routes/sync/sync.ts`
- **[models]** `src/models/*` (RBAC scoping and associations)
