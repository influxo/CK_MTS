Findings
Existing sync: You already had JSON-based sync endpoints POST /sync/pull and POST /sync/push wired via 
src/routes/sync/sync.ts
 to 
src/controllers/sync/index.ts
.
RBAC: Tokens resolved through 
src/middlewares/auth.ts
 with role/permission loading. The sync controller respects req.user.allowedProgramIds throughout.
DB stack: Sequelize + Postgres via 
src/db/connection.ts
. Models defined under 
src/models/
 and associations in 
src/models/index.ts
.
Changes Implemented
[controller] 
src/controllers/sync/index.ts
Added 
full(req,res)
: builds an RBAC-scoped SQLite snapshot with better-sqlite3 and streams as binary.
Added 
upload(req,res)
: accepts { mutations: Change[] } and forwards to existing 
push()
 (maps to body.changes) to reuse your conflict-sanitized logic.
Kept existing 
pull
 and 
push
 fully intact.
Scoped beneficiaries in snapshot using 
BeneficiaryAssignment
 when not admin, and included only encrypted PII fields in the SQLite file.
Default export updated to include 
full
 and 
upload
.
[routes] 
src/routes/sync/sync.ts
Added GET /sync/full (Swagger doc included).
Added POST /sync/upload (Swagger doc included).
Kept POST /sync/pull and POST /sync/push.
[dependencies] 
package.json
Added "better-sqlite3": "^8.7.0".
Added "@types/better-sqlite3": "^7.6.9" to devDependencies.
[documentation] 
docs/offline-sync-sqlite-jira.md
Jira-formatted EPIC, stories, tasks, risks, metrics, and rollout plan to track progress.
How the New Offline Snapshot Works
RBAC filter:
Projects limited to req.user.allowedProgramIds unless admin.
Subprojects limited by allowed projects.
Activities limited via Subproject -> Project join.
Beneficiaries limited via 
BeneficiaryAssignment
 to allowed projects/subprojects.
PII:
Only encrypted PII (*_Enc) columns are stored in beneficiaries within SQLite, no plaintext.
Schema included in v1:
projects, subprojects, activities
users, project_users, subproject_users
form_templates, form_entity_associations
services, service_assignments
beneficiaries (encrypted fields only)
You can extend the SQLite schema later (e.g., include service deliveries, forms responses) as needed.
Usage Examples
Download full snapshot
Endpoint: GET /sync/full
Headers: Authorization: Bearer <JWT>
Response: application/octet-stream SQLite file
Upload queued offline changes
Endpoint: POST /sync/upload
Body: { "mutations": Array<Change> } where each Change resembles the existing push format (mapped to changes internally)
Response: per-mutation results, including any conflicts/errors
Lint/Build Notes
In 
src/controllers/sync/index.ts
 you’ll see a TypeScript error until packages are installed:
Cannot find module 'better-sqlite3' or its types. This resolves after installing new deps.
Recommended Actions
[install deps]
Install better-sqlite3 and its types to resolve the module/type error.
[run dev]
Start the API and test endpoints.
[verify RBAC]
Test with a non-admin user limited to specific allowedProgramIds to confirm scoping.
[frontend plan]
Decide on the local DB engine (e.g., better-sqlite3 via bridge or IndexedDB/Dexie importing SQLite via WASM). Align schema expectations with the snapshot.
Proposed Commands
Install new dependencies (will modify your system; needs approval)
PowerShell:
powershell
npm install
If prebuilt binaries are not available on Windows, you may need build tools (Visual Studio Build Tools, Python 3) to compile better-sqlite3.
Run dev server (after install)
powershell
npm run dev
Optional test with curl:
powershell
curl -H "Authorization: Bearer <TOKEN>" -X GET http://localhost:3000/sync/full -o snapshot.sqlite
File References
Controller: 
src/controllers/sync/index.ts
 (exports 
pull
, 
push
, 
full
, 
upload
)
Routes: 
src/routes/sync/sync.ts
 (adds /sync/full, /sync/upload)
Docs (Jira-style): 
docs/offline-sync-sqlite-jira.md
Models/Associations: 
src/models/
, 
src/models/index.ts
Task Status
Implemented: /sync/full, /sync/upload, RBAC scoping, SQLite schema export, beneficiaries encryption policy, routes, Jira doc.
Pending: Install packages and run server to validate locally; design incremental sync and richer conflict reporting per your plan.