## CK-MTS Database Schema (for Metabase)

This document summarizes Sequelize models, their columns, types, constraints, indexes, and relationships to help configure Metabase metadata.

### Conventions
- UUID primary keys unless noted
- Timestamps: `createdAt`, `updatedAt` where present
- JSONB implies Postgres JSONB (falls back to JSON in other dialects)

---

## users
- id: UUID, PK, default uuidv4()
- firstName: STRING, not null
- lastName: STRING, not null
- email: STRING, not null, unique, validate isEmail
- password: STRING, not null
- status: STRING, not null, default 'active', enum ['active','inactive','invited','suspended']
- emailVerified: BOOLEAN, not null, default false
- verificationToken: STRING, null, default random hex
- tokenExpiry: DATE, null, default now + 7 days
- invitedBy: UUID, null, FK → users.id
- twoFactorSecret: STRING, null
- twoFactorEnabled: BOOLEAN, not null, default false
- lastLogin: DATE, null
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- email UNIQUE
- invitedBy (FK)

Relationships:
- users ↔ roles via user_roles (M:N)
- users ↔ projects via project_users (M:N)
- users ↔ subprojects via subproject_users (M:N)
- users ↔ activities via activity_users (M:N)
- users (1:M) form_responses.submittedBy
- users (1:M) service_deliveries.staffUserId
- users (1:M) logs.userId (implicit)

---

## roles
- id: UUID, PK, default uuidv4()
- name: STRING, not null, unique
- description: STRING, null
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Relationships:
- roles ↔ users via user_roles (M:N)
- roles ↔ permissions via role_permissions (M:N)

---

## permissions
- id: UUID, PK, default uuidv4()
- name: STRING, not null, unique
- description: STRING, null
- resource: STRING, not null
- action: STRING, not null
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Relationships:
- permissions ↔ roles via role_permissions (M:N)

---

## user_roles
- id: UUID, PK, default uuidv4()
- userId: UUID, not null, FK → users.id
- roleId: UUID, not null, FK → roles.id
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- UNIQUE (userId, roleId)

---

## role_permissions
- id: UUID, PK, default uuidv4()
- roleId: UUID, not null, FK → roles.id
- permissionId: UUID, not null, FK → permissions.id
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- UNIQUE (roleId, permissionId)

---

## logs
- id: UUID, PK, default uuidv4()
- timestamp: DATE, not null, default now
- method: STRING, not null
- url: STRING, not null
- status: INTEGER, not null
- responseTime: INTEGER, not null
- ip: STRING, null
- userAgent: STRING, null
- userId: STRING, null

Notes:
- No Sequelize timestamps; uses `timestamp`

---

## projects
- id: UUID, PK, default uuidv4()
- name: STRING, not null
- description: TEXT, null
- category: TEXT, null
- status: STRING, not null, default 'active', enum ['active','inactive']
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Relationships:
- projects ↔ users via project_users (M:N)
- projects (1:M) subprojects
- projects (1:M) form_templates via programId (see association)
- projects (1:M) service_assignments (via polymorphic link)
- projects (1:M) beneficiary_assignments (via polymorphic link)

---

## project_users
- id: UUID, PK, default uuidv4()
- projectId: UUID, not null, FK → projects.id
- userId: UUID, not null, FK → users.id
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- UNIQUE (projectId, userId)

---

## subprojects
- id: UUID, PK, default uuidv4()
- name: STRING, not null
- description: TEXT, null
- category: TEXT, null
- status: STRING, not null, default 'active', enum ['active','inactive']
- projectId: UUID, not null, FK → projects.id
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Relationships:
- subprojects ↔ users via subproject_users (M:N)
- subprojects (1:M) activities
- subprojects (M:1) projects
- subprojects (1:M) service_assignments (via polymorphic link)
- subprojects (1:M) beneficiary_assignments (via polymorphic link)

---

## subproject_users
- id: UUID, PK, default uuidv4()
- userId: UUID, not null, FK → users.id
- subprojectId: UUID, not null, FK → subprojects.id
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- UNIQUE (userId, subprojectId)

---

## activities
- id: UUID, PK, default uuidv4()
- name: STRING, not null
- description: TEXT, null
- category: TEXT, null
- frequency: STRING, null
- reportingFields: TEXT (JSON string), null
- subprojectId: UUID, not null, FK → subprojects.id
- status: STRING, not null, default 'active', enum ['active','inactive']
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Relationships:
- activities ↔ users via activity_users (M:N)
- activities (M:1) subprojects
- activities (1:M) service_deliveries (via polymorphic link)

---

## activity_users
- id: UUID, PK, default uuidv4()
- userId: UUID, not null, FK → users.id
- activityId: UUID, not null, FK → activities.id
- role: STRING, null
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- UNIQUE (userId, activityId)

---

## form_templates
- id: UUID, PK, default uuidv4()
- name: STRING, not null
- schema: JSONB, not null
- version: INTEGER, not null, default 1
- status: STRING, not null, default 'active', enum ['active','inactive']
- includeBeneficiaries: BOOLEAN, not null, default false
- programId: UUID, FK → projects.id (from association)
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now
- deletedAt: DATE, null (paranoid)

Relationships:
- form_templates (M:1) projects via programId
- form_templates (1:M) form_responses
- form_templates (1:1) beneficiary_mappings

---

## form_fields
- id: UUID, PK
- name: STRING, not null
- type: STRING, not null
- description: TEXT, null
- isKpiField: BOOLEAN, not null, default false
- createdAt: DATE, not null
- updatedAt: DATE, not null

Relationships:
- form_fields (1:M) kpis

---

## form_responses
- id: UUID, PK, default uuidv4()
- formTemplateId: UUID, not null, FK → form_templates.id
- entityId: UUID, not null
- entityType: STRING, not null, enum ['project','subproject','activity']
- submittedBy: UUID, not null, FK → users.id
- beneficiaryId: UUID, null, FK → beneficiaries.id
- data: JSONB, not null
- latitude: DECIMAL(9,6), null
- longitude: DECIMAL(9,6), null
- submittedAt: DATE, not null, default now
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Relationships:
- form_responses (M:1) form_templates
- form_responses (M:1) users (submittedBy)
- form_responses (M:1) beneficiaries (optional)
- form_responses (1:M) service_deliveries

---

## audit_logs
- id: UUID, PK, default uuidv4()
- userId: UUID, not null
- action: STRING, not null
- description: STRING, not null
- details: TEXT, null
- timestamp: DATE, not null, default now

Notes:
- No Sequelize timestamps; uses `timestamp`

---

## kpis
- id: UUID, PK
- name: STRING, not null
- description: TEXT, null
- calculationType: ENUM('COUNT','SUM','AVERAGE','MIN','MAX','PERCENTAGE','CUSTOM'), not null
- fieldId: UUID, not null, FK → form_fields.id
- aggregationType: ENUM('DAILY','WEEKLY','MONTHLY','QUARTERLY','YEARLY','ALL_TIME'), not null, default 'ALL_TIME'
- filterCriteria: JSONB, null
- isActive: BOOLEAN, not null, default true
- createdAt: DATE, not null
- updatedAt: DATE, not null

Relationships:
- kpis (M:1) form_fields

---

## beneficiaries
- id: UUID, PK, default uuidv4()
- pseudonym: STRING, not null, unique
- status: STRING, not null, default 'active', enum ['active','inactive']
- firstNameEnc: JSONB, null
- lastNameEnc: JSONB, null
- dobEnc: JSONB, null
- genderEnc: JSONB, null
- addressEnc: JSONB, null
- municipalityEnc: JSONB, null
- nationalityEnc: JSONB, null
- nationalIdEnc: JSONB, null
- phoneEnc: JSONB, null
- emailEnc: JSONB, null
- ethnicityEnc: JSONB, null
- residenceEnc: JSONB, null
- householdMembersEnc: JSONB, null
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- UNIQUE (pseudonym)
- status

Relationships:
- beneficiaries (1:M) beneficiary_match_keys
- beneficiaries (1:1) beneficiary_details
- beneficiaries (1:M) beneficiary_assignments (polymorphic)
- beneficiaries (1:M) form_responses
- beneficiaries (1:M) service_deliveries

---

## beneficiary_match_keys
- id: UUID, PK, default uuidv4()
- beneficiaryId: UUID, not null, FK → beneficiaries.id
- keyType: STRING, not null
- keyHash: STRING, not null
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- UNIQUE (keyType, keyHash)
- beneficiaryId

---

## beneficiary_mappings
- id: UUID, PK, default uuidv4()
- formTemplateId: UUID, not null, unique, FK → form_templates.id
- mapping: JSONB, not null
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Relationships:
- beneficiary_mappings (M:1) form_templates

---

## beneficiary_details
- id: UUID, PK, default uuidv4()
- beneficiaryId: UUID, not null, FK → beneficiaries.id, onDelete CASCADE, onUpdate CASCADE
- details: JSONB, not null, default {}
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- UNIQUE (beneficiaryId)

Relationships:
- beneficiary_details (M:1) beneficiaries

---

## beneficiary_assignments
- id: UUID, PK, default uuidv4()
- beneficiaryId: UUID, not null, FK → beneficiaries.id
- entityId: UUID, not null
- entityType: STRING, not null, enum ['project','subproject']
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- UNIQUE (beneficiaryId, entityId, entityType)
- (entityId, entityType)
- beneficiaryId

Notes:
- Polymorphic link connecting beneficiaries to projects or subprojects

---

## services
- id: UUID, PK, default uuidv4()
- name: STRING, not null
- description: TEXT, null
- category: STRING, null
- status: STRING, not null, default 'active', enum ['active','inactive']
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Relationships:
- services (1:M) service_assignments
- services (1:M) service_deliveries

---

## service_assignments
- id: UUID, PK, default uuidv4()
- serviceId: UUID, not null, FK → services.id
- entityId: UUID, not null
- entityType: STRING, not null, enum ['project','subproject']
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- UNIQUE (serviceId, entityId, entityType)
- (entityId, entityType)

Notes:
- Polymorphic link connecting services to projects or subprojects

---

## service_deliveries
- id: UUID, PK, default uuidv4()
- serviceId: UUID, not null, FK → services.id
- beneficiaryId: UUID, not null, FK → beneficiaries.id
- entityId: UUID, not null
- entityType: STRING, not null, enum ['project','subproject','activity']
- formResponseId: UUID, null, FK → form_responses.id
- staffUserId: UUID, null, FK → users.id
- deliveredAt: DATE, not null
- notes: TEXT, null
- createdAt: DATE, not null, default now
- updatedAt: DATE, not null, default now

Indexes:
- beneficiaryId
- serviceId
- (entityId, entityType)
- deliveredAt

Notes:
- Polymorphic link; optionally tied to a form_response and staff user

---

## form_entity_associations (inferred)
- If present in DB: links `form_templates` to other entities (see code `FormEntityAssociation`)
- Not explicitly defined in repo schema above; check actual DB for table presence

---

### Relationship Diagram (high-level)
- users M:N roles via user_roles
- roles M:N permissions via role_permissions
- projects M:N users via project_users
- projects 1:M subprojects
- subprojects M:N users via subproject_users
- subprojects 1:M activities
- activities M:N users via activity_users
- projects 1:M form_templates
- form_templates 1:M form_responses
- users 1:M form_responses (submittedBy)
- beneficiaries 1:M form_responses
- form_responses 1:M service_deliveries
- services 1:M service_assignments
- services 1:M service_deliveries
- beneficiaries 1:M service_deliveries
- users 1:M service_deliveries (staffUserId)
- beneficiaries 1:M beneficiary_match_keys
- beneficiaries 1:1 beneficiary_details
- beneficiaries 1:M beneficiary_assignments (→ project/subproject)
- form_templates 1:1 beneficiary_mappings
