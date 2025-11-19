# Offline Sync API Guide

- **Audience**: Flutter developers building offline-first mobile applications
- **Endpoints**: `GET /sync/datadump`, `POST /sync/uploads`
- **Auth**: Bearer JWT (same as the rest of the API)
- **RBAC**: All data is scoped by the authenticated user's permissions (`allowedProgramIds`)

---

## Overview

- **/sync/datadump** returns a comprehensive JSON dataset containing all entities, form definitions, association metadata, and storage mapping metadata for related to that USER (pay attention RBAC) Flutter offline use.
- **/sync/uploads** accepts completed survey responses from Flutter and stores them in the correct relational database tables using storage mapping metadata. Upload requests must align with the association metadata provided in the datadump.

This guide explains the Flutter-specific request/response formats, storage mapping system, typical offline flows, error handling, and data structures.

---

## Authentication

- The mobile app must authenticate first and store the returned JWT securely.
- All subsequent sync requests must include the JWT in the `Authorization` header: `Authorization: Bearer <JWT>`.

### POST /auth/login

- Purpose: authenticate a user and retrieve a JWT.
- Method: POST
- Body (JSON):
```json
{
  "email": "user@example.com",
  "password": "<password>"
}
```
- Response (200 OK):
```json
{
  "success": true,
  "token": "<JWT>",
  "expiresIn": 3600,
  "user": {
    "id": "<uuid>",
    "email": "user@example.com",
    "firstName": "Jane",
    "lastName": "Doe",
    "roles": ["Field Operator"]
  }
}
```

Notes:
- Store `token` in the device's secure storage (Keychain/Keystore). Do not store in plaintext.
- Send the token in the `Authorization` header for all API calls.
- If your app supports long-lived sessions, also store `expiresIn` and renew the token as needed (see refresh below if implemented).

### (Optional) POST /auth/refresh

- If enabled, exchanges a valid (non-revoked) token/refresh token for a new JWT.
- Request/response shape follows your standard auth service. Include the refreshed `token` in subsequent requests.

## GET /sync/datadump

- **Purpose**: Download a comprehensive JSON dataset containing all entities, form definitions, and storage mapping metadata for Flutter offline use.
- **Method**: GET
- **Auth**: `Authorization: Bearer <JWT>`
- **Response**: `200 OK`, `Content-Type: application/json`

### Request

- No body
- Example (curl):
```bash
curl -H "Authorization: Bearer <TOKEN>" \
  -X GET http://<host>:<port>/sync/datadump \
  -o datadump.json
```

### Response Structure

The response contains a hierarchical JSON structure with all user-accessible data:

```json
{
  "meta": {
    "schemaVersion": 2,
    "generatedAt": "2025-10-15T08:00:00Z",
    "userId": "u-123",
    "roleNames": ["Field Operator"],
    "isAdmin": false,
    "allowedPrograms": ["p-001", "p-002"],
    "accessibleBeneficiaries": 150,
    "totalBeneficiaries": 200,
    "piiAccessPolicy": "project-scoped"
  },
  "projects": [
    {
      "id": "p-001",
      "name": "Health Outreach",
      "description": "Community health program",
      "category": "health",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-10-15T08:00:00Z"
    }
  ],
  "subprojects": [
    {
      "id": "sp-100",
      "projectId": "p-001",
      "name": "Village A",
      "description": "Health services for Village A",
      "category": "rural",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-10-15T08:00:00Z"
    }
  ],
  "activities": [
    {
      "id": "act-200",
      "subprojectId": "sp-100",
      "name": "Monthly Health Check",
      "description": "Regular health monitoring",
      "category": "monitoring",
      "frequency": "monthly",
      "reportingFields": {"required": ["blood_pressure", "weight"]},
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-10-15T08:00:00Z"
    }
  ],
  "form_templates": [
    {
      "id": "f-123",
      "name": "Household Survey",
      "schema": {
        "type": "object",
        "properties": {
          "household_head": {"type": "string", "title": "Head of Household"},
          "members_count": {"type": "number", "title": "Number of Members"},
          "water_source": {"type": "string", "title": "Water Source", "enum": ["well", "tap", "river"]}
        },
        "required": ["household_head", "members_count"]
      },
      "version": "2.0.1",
      "status": "active",
      "includeBeneficiaries": true,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-10-15T08:00:00Z",
      "associations": {
        "subprojectId": "sp-100",
        "serviceIds": ["svc-55"],
        "beneficiaryIds": ["b-501"]
      },
      "storageMapping": {
        "targetTable": "form_responses",
        "beneficiaryFields": {
          "firstName": "firstNameEnc",
          "lastName": "lastNameEnc", 
          "dob": "dobEnc",
          "nationalId": "nationalIdEnc",
          "phone": "phoneEnc",
          "email": "emailEnc",
          "address": "addressEnc",
          "gender": "genderEnc",
          "municipality": "municipalityEnc",
          "nationality": "nationalityEnc",
          "ethnicity": "ethnicityEnc",
          "residence": "residenceEnc",
          "householdMembers": "householdMembersEnc"
        },
        "responseFields": {
          "household_head": "household_head",
          "members_count": "members_count", 
          "water_source": "water_source"
        },
        "entityMapping": {
          "projectId": "entityId",
          "subprojectId": "entityId",
          "entityType": "subproject"
        },
        "serviceMapping": {
          "serviceIds": "serviceId",
          "deliveredAt": "deliveredAt",
          "notes": "notes"
        }
      }
    }
  ],
  "services": [
    {
      "id": "svc-55",
      "name": "Medical Checkup",
      "description": "Basic health examination",
      "category": "health",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-10-15T08:00:00Z"
    }
  ],
  "beneficiaries": [
    {
      "id": "b-501",
      "pseudonym": "BNF-12345",
      "status": "active",
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-10-15T08:00:00Z",
      "piiEnc": {
        "firstNameEnc": "encrypted_data",
        "lastNameEnc": "encrypted_data",
        "dobEnc": "encrypted_data",
        "genderEnc": "encrypted_data",
        "addressEnc": "encrypted_data",
        "municipalityEnc": "encrypted_data",
        "nationalityEnc": "encrypted_data",
        "nationalIdEnc": "encrypted_data",
        "phoneEnc": "encrypted_data",
        "emailEnc": "encrypted_data",
        "ethnicityEnc": "encrypted_data",
        "residenceEnc": "encrypted_data",
        "householdMembersEnc": "encrypted_data"
      },
      "pii": {
        "beneficiaryId": "b-501",
        "firstName": "Ilir",
        "lastName": "D.",
        "dob": "1990-01-01",
        "gender": "M",
        "address": "Village A, Street 1",
        "municipality": "Pristina",
        "nationality": "Kosovar",
        "nationalId": "1234567890",
        "phone": "+38344123456",
        "email": "ilir@example.com",
        "ethnicity": "Albanian",
        "residence": "rural",
        "householdMembers": 4
      }
    }
  ],
  "form_responses": [
    {
      "id": "fr-001",
      "formTemplateId": "f-123",
      "entityId": "sp-100",
      "entityType": "subproject",
      "submittedBy": "u-123",
      "beneficiaryId": "b-501",
      "data": {
        "household_head": "Ilir D.",
        "members_count": 4,
        "water_source": "well"
      },
      "latitude": 42.662,
      "longitude": 21.164
      "submittedAt": "2025-10-15T09:00:00Z",
      "template": {
        "id": "f-123",
        "name": "Household Survey",
        "schema": "{...}",
        "version": "2.0.1"
      },
      "submitter": {
        "id": "u-123",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "createdAt": "2025-10-15T09:00:00Z",
      "updatedAt": "2025-10-15T09:00:00Z"
    }
  ],
  "service_deliveries": [
    {
      "id": "sd-001",
      "serviceId": "svc-55",
      "beneficiaryId": "b-501",
      "entityId": "sp-100",
      "entityType": "subproject",
      "formResponseId": "fr-001",
      "staffUserId": "u-123",
      "deliveredAt": "2025-10-15T09:05:00Z",
      "notes": "Regular checkup completed",
      "service": {
        "id": "svc-55",
        "name": "Medical Checkup",
        "description": "Basic health examination",
        "category": "health"
      },
      "staff": {
        "id": "u-123",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com"
      },
      "beneficiary": {
        "id": "b-501",
        "pseudonym": "BNF-12345",
        "status": "active"
      },
      "createdAt": "2025-10-15T09:05:00Z",
      "updatedAt": "2025-10-15T09:05:00Z"
    }
  ]
}
```

### Storage Mapping Metadata

Each form template includes a `storageMapping` object that tells the backend how to process schemaless survey responses:

- **`targetTable`**: The primary database table where form responses are stored (e.g., `form_responses`)
- **`beneficiaryFields`**: Maps form field names to beneficiary PII field names for automatic beneficiary creation
- **`responseFields`**: Maps form field names to the `data` JSONB column in `form_responses` table (optional - all fields are stored by default)
- **`entityMapping`**: Maps contextual data (projectId, subprojectId) to entity assignments in `beneficiary_assignments` table
- **`serviceMapping`**: Maps service-related form fields to service delivery objects in `service_deliveries` table

**Note**: Since forms are schemaless, the `data` field in `form_responses` stores the complete raw response. The mapping is used for:
1. **Beneficiary Creation**: Extract PII fields from form responses to create beneficiaries
2. **Service Delivery**: Extract service information to create service delivery records
3. **Entity Assignment**: Link beneficiaries to projects/subprojects

#### Example Storage Mapping
```json
{
  "storageMapping": {
    "targetTable": "form_responses",
    "beneficiaryFields": {
      "firstName": "firstNameEnc",
      "lastName": "lastNameEnc", 
      "dob": "dobEnc",
      "nationalId": "nationalIdEnc",
      "phone": "phoneEnc",
      "email": "emailEnc",
      "address": "addressEnc",
      "gender": "genderEnc",
      "municipality": "municipalityEnc",
      "nationality": "nationalityEnc",
      "ethnicity": "ethnicityEnc",
      "residence": "residenceEnc",
      "householdMembers": "householdMembersEnc"
    },
    "responseFields": {
      "household_head": "household_head",
      "members_count": "members_count", 
      "water_source": "water_source"
    },
    "entityMapping": {
      "projectId": "entityId",
      "subprojectId": "entityId",
      "entityType": "subproject"
    },
    "serviceMapping": {
      "serviceIds": "serviceId",
      "deliveredAt": "deliveredAt",
      "notes": "notes"
    }
  }
}
```

### Error codes
- `401/403`: Missing or invalid token, or forbidden.
- `500`: Unexpected server error.

### Client handling tips
- Store the complete JSON response in Flutter's local database
- Use the `meta.generatedAt` timestamp for cache invalidation
- Process `storageMapping` metadata to understand how to structure upload requests
- Handle PII data according to the `piiAccessPolicy` in metadata

---

## POST /sync/uploads

- **Purpose**: Upload completed survey responses from Flutter and store them in the correct relational database tables.
- **Method**: POST
- **Auth**: `Authorization: Bearer <JWT>`
- **Request**: JSON body `{ surveys: SurveyResponse[] }`
- **Response**: JSON with per-survey results and manifest confirmations

Important constraints:
- No database/schema changes are introduced by this spec.
- Only the two endpoints are modified: `GET /sync/datadump` and `POST /sync/uploads`.
- Location is persisted exactly as the web app does: `latitude` and `longitude` are stored on the `form_responses` record (DECIMAL(9,6), ~0.1m accuracy, suitable for 2-3 meter accuracy requirements). Service deliveries do not store location.

### Request body
```json
{
  "surveys": [
    {
      "clientRequestId": "local-uuid-123",
      "projectId": "p-001",
      "subprojectId": "sp-100",
      "formId": "f-123",
      "beneficiaryIds": ["b-501"],
      "serviceIds": ["svc-55"],
      "answers": {
        "household_head": "Ilir",
        "members_count": 5,
        "water_source": "well"
      },
      "metadata": {
        "deviceId": "android-xyz",
        "appVersion": "1.3.0",
        "location": { "lat": 42.662, "lng": 21.164 }
        "timestamp": "2025-10-15T09:00:00Z"
      }
    },
    {
      "clientRequestId": "local-uuid-124",
      "projectId": "p-001",
      "subprojectId": "sp-100",
      "formId": "f-124",
      "beneficiaryIds": ["b-502"],
      "serviceIds": ["svc-56", "svc-57"],
      "answers": {
        "blood_pressure": "120/80",
        "weight": 70,
        "temperature": 36.5
      },
      "metadata": {
        "deviceId": "android-xyz",
        "appVersion": "1.3.0",
        "location": { "lat": 42.663, "lng": 21.165 },
        "timestamp": "2025-10-15T09:15:00Z"
      }
    }
  ]
}
```

### Request Fields

- **`clientRequestId`**: Unique identifier generated by Flutter (UUID) for idempotency
- **`projectId`**: ID of the project this survey belongs to
- **`subprojectId`**: ID of the subproject this survey belongs to
- **`formId`**: ID of the form template used for this survey
- **`beneficiaryIds`**: Optional array of beneficiary IDs this survey is about (must be subset of declared associations if `includeBeneficiaries=true`)
- **`serviceIds`**: Array of service IDs delivered during this survey
- **`answers`**: The actual survey responses (field names match form schema)
- **`metadata`**: Additional context about the survey submission

### Backend Processing

The `/sync/uploads` endpoint processes schemaless Flutter survey data by:

1. **Lookup Form Template**: Uses `formId` to find the form template, its schema, and `storageMapping`
2. **Validate Form Data**: Uses the template's schema to validate the survey responses against the expected structure
3. **Validate Associations (No DB change)**:
   - Resolve `formId` to the per-user `associations` emitted by datadump
   - Enforce `subprojectId === associations.subprojectId`
   - Enforce all `serviceIds` ⊆ `associations.serviceIds`
   - If `includeBeneficiaries=true`, enforce all `beneficiaryIds` ⊆ `associations.beneficiaryIds`; if `includeBeneficiaries=false`, reject any provided `beneficiaryIds`
4. **Validate IDs**: Ensures project, subproject, service, and beneficiary IDs are valid and accessible to the user
5. **Process Each Survey**:
   - **Create Beneficiary** (if needed): Extract PII fields from survey responses using `storageMapping.beneficiaryFields` and create beneficiary
   - **Assign Beneficiary to Entities**: Insert into `beneficiary_assignments` table to link beneficiary to project/subproject
   - **Create Form Response**: Insert into `form_responses` table with the complete raw survey data in the `data` JSONB field. Persist `latitude` and `longitude` from `metadata.location` and `submittedAt` from `metadata.timestamp`.
   - **Create Service Deliveries**: Extract service information using `storageMapping.serviceMapping` and create service delivery records
6. **Generate Manifest**: Creates a unique manifest ID for tracking

**Key Point**: The system is designed for schemaless data - each form can have completely different fields and structures. The `data` field stores the raw response, while mappings are used to extract specific information for related entities.

### Database Storage Mapping

#### Beneficiary Creation
```json
// Flutter survey data with beneficiary info
{
  "beneficiaryId": "b-501", // If new beneficiary
  "answers": {
    "firstName": "Ilir",
    "lastName": "D.",
          "dob": "1990-01-01",
    "nationalId": "1234567890",
    "phone": "+38344123456",
    "email": "ilir@example.com",
    "address": "Village A, Street 1",
    "gender": "M",
    "municipality": "Pristina",
    "nationality": "Kosovar",
    "ethnicity": "Albanian",
    "residence": "Rural",
          "householdMembers": 4
        }
      }

// Directly inserted into: beneficiaries table
{
  "id": "generated-uuid",
  "pseudonym": "BNF-12345", // Generated if not provided
  "firstNameEnc": "encrypted_firstName",
  "lastNameEnc": "encrypted_lastName",
  "dobEnc": "encrypted_dob",
  "nationalIdEnc": "encrypted_nationalId",
  "phoneEnc": "encrypted_phone",
  "emailEnc": "encrypted_email",
  "addressEnc": "encrypted_address",
  "genderEnc": "encrypted_gender",
  "municipalityEnc": "encrypted_municipality",
  "nationalityEnc": "encrypted_nationality",
  "ethnicityEnc": "encrypted_ethnicity",
  "residenceEnc": "encrypted_residence",
  "householdMembersEnc": "encrypted_householdMembers",
  "status": "active",
  "createdBy": "current-user-id",
  "createdAt": "2025-10-15T09:00:00Z",
  "updatedAt": "2025-10-15T09:00:00Z"
}
```

#### Beneficiary Entity Assignment
```json
// Directly inserted into: beneficiary_assignments table
[
  {
    "id": "generated-uuid-1",
    "beneficiaryId": "b-501",
    "entityId": "p-001",
    "entityType": "project",
    "createdAt": "2025-10-15T09:00:00Z",
    "updatedAt": "2025-10-15T09:00:00Z"
  },
  {
    "id": "generated-uuid-2", 
    "beneficiaryId": "b-501",
    "entityId": "sp-100",
    "entityType": "subproject",
    "createdAt": "2025-10-15T09:00:00Z",
    "updatedAt": "2025-10-15T09:00:00Z"
  }
]
```

#### Form Response Creation
```json
// Flutter survey data
{
  "formId": "f-123",
  "projectId": "p-001",
  "subprojectId": "sp-100",
  "beneficiaryId": "b-501",
  "serviceIds": ["svc-55"],
  "answers": {
    "household_head": "Ilir",
    "members_count": 5,
    "water_source": "well"
  },
  "metadata": {
    "location": { "lat": 42.3, "lng": 21.1 },
    "timestamp": "2025-10-15T09:00:00Z"
  }
}

// Directly inserted into: form_responses table
{
  "id": "generated-uuid",
  "formTemplateId": "f-123",
  "entityId": "sp-100",
  "entityType": "subproject",
  "submittedBy": "current-user-id",
  "beneficiaryId": "b-501",
  "data": {
    "household_head": "Ilir",
    "members_count": 5,
    "water_source": "well"
  },
  "latitude": 42.662,
  "longitude": 21.164,
  "submittedAt": "2025-10-15T09:00:00Z",
  "createdAt": "2025-10-15T09:00:00Z",
  "updatedAt": "2025-10-15T09:00:00Z"
}
```

#### Service Delivery Creation
```json
// For each serviceId in serviceIds array, insert into: service_deliveries table
{
  "id": "generated-uuid",
  "serviceId": "svc-55",
  "beneficiaryId": "b-501",
  "entityId": "sp-100",
  "entityType": "subproject",
  "formResponseId": "form-response-uuid",
  "staffUserId": "current-user-id",
  "deliveredAt": "2025-10-15T09:00:00Z",
  "notes": "Offline survey submission",
  "createdAt": "2025-10-15T09:00:00Z",
  "updatedAt": "2025-10-15T09:00:00Z"
}
```

### Complete Upload Flow

The `/sync/uploads` endpoint processes each survey through the following steps:

1. **Parse Survey Data**: Extract `clientRequestId`, `formId`, `projectId`, `subprojectId`, `beneficiaryId`, `serviceIds`, `answers`, and `metadata`

2. **Lookup Form Template**: Find the form template by `formId` and retrieve its schema and `storageMapping`

3. **Validate Form Data**: Use the template's schema to validate the survey responses against the expected structure (using AJV validation)

4. **Process Beneficiary** (if needed):
   - If `beneficiaryId` is provided and exists, use it
   - If `beneficiaryId` is provided but doesn't exist, create new beneficiary by extracting PII from `answers` using `storageMapping.beneficiaryFields`
   - If no `beneficiaryId` but beneficiary data in `answers`, extract PII and create new beneficiary
   - Assign beneficiary to entities by inserting into `beneficiary_assignments` table

5. **Create Form Response**: Insert into `form_responses` table with:
   - Complete raw survey data in `data` JSONB field (schemaless storage)
   - Location from `metadata.location`
   - Beneficiary ID and entity information
   - Generated UUID and timestamps

6. **Create Service Deliveries**: For each `serviceId`, insert into `service_deliveries` table with:
   - Service ID, beneficiary ID, entity information
   - Form response ID for linking
   - Delivery timestamp and notes

7. **Generate Manifest**: Create unique manifest ID for tracking

8. **Return Results**: Provide status and manifest ID for each processed survey

**Schemaless Handling**: The system stores the complete raw response in the `data` field, allowing for maximum flexibility. Each form can have completely different structures, and the system adapts accordingly.

### Error Handling

- **Validation Errors**: Return `status: "error"` with specific validation message
- **Association Errors**: Return `422 INVALID_ASSOCIATION` if `subprojectId`, `serviceIds`, or `beneficiaryIds` are outside the form's declared associations
- **Database Failures**: If any database insert operations fail, return `status: "error"` with database error details
- **RBAC Violations**: If user doesn't have access to project/subproject, return `status: "error"`
- **Missing Dependencies**: If form template or required IDs don't exist, return `status: "error"`
- **Encryption Failures**: If PII encryption fails during beneficiary creation, return `status: "error"`
- **Constraint Violations**: If database constraints are violated (duplicate keys, foreign key violations), return `status: "error"`
 - **Idempotency**: Return `409` with existing manifest if the same `clientRequestId` is replayed

### Response body
```json
{
  "status": "ok",
  "manifestId": "manifest-2025-10-15T09:00:01Z",
  "manifest": {
    "id": "manifest-2025-10-15T09:00:01Z",
    "generatedAt": "2025-10-15T09:00:01Z",
    "summary": {
      "totalSurveys": 2,
      "successfulSurveys": 2,
      "failedSurveys": 0,
      "successRate": "100.00%"
    },
    "forms": { "count": 1, "forms": [{"id": "f-123", "name": "Household Survey", "version": 2, "includeBeneficiaries": true, "fieldCount": 3, "usageCount": 2}] },
    "projects": { "count": 1, "projects": [{"id": "p-001", "name": "Health Outreach", "category": "health", "status": "active"}] },
    "subprojects": { "count": 1, "subprojects": [{"id": "sp-100", "name": "Village A", "category": "rural", "status": "active", "projectId": "p-001"}] },
    "beneficiaries": { "count": 2, "surveyed": ["b-501", "b-502"], "created": 1, "existing": 1 },
    "services": { "count": 2, "services": [{"id": "svc-55", "name": "Medical Checkup", "description": "Basic health examination", "category": "health", "deliveryCount": 2}], "totalDeliveries": 2 },
    "data": [/* per-survey manifest entries */]
  },
  "results": [
    {
      "clientRequestId": "local-uuid-123",
      "serverSurveyId": "srv-abc-999",
      "manifestId": "manifest-2025-10-15T09:00:01Z",
      "status": "applied",
      "entityType": "formSubmission"
    },
    {
      "clientRequestId": "local-uuid-124",
      "serverSurveyId": "srv-abc-1000",
      "manifestId": "manifest-2025-10-15T09:15:01Z",
      "status": "applied",
      "entityType": "formSubmission"
    }
  ]
}
```

### Per-survey status
- **`applied`**: Survey successfully stored in the database
- **`error`**: Survey rejected due to validation errors, RBAC violations, or missing associations
- **`ignored`**: Survey skipped due to unrecognized form ID or unsupported format

### Error scenarios
- **Validation errors**: Form schema validation fails → `status: "error"` per survey
- **RBAC violations**: Project/subproject outside user scope → `status: "error"` per survey
- **Missing form template**: Form ID not found or not associated with the entity → `status: "error"`
- **Invalid IDs**: Project, subproject, service, or beneficiary ID doesn't exist → `status: "error"`
- **Storage mapping errors**: Target table doesn't exist or field mapping is invalid → `status: "error"`

### Idempotency & Conflict Resolution
- Each request includes `clientRequestId` (Flutter-generated UUID)
- Backend returns the same `manifestId` if duplicate `clientRequestId` is detected (HTTP 409)
- Flutter should not resend surveys that have already been successfully uploaded
- Network retries with the same `clientRequestId` will return the original response

### Example (curl)
```bash
curl -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d @surveys.json \
  http://<host>:<port>/sync/uploads
```

### Example (Dart/Flutter)
```dart
Future<List<Map<String, dynamic>>> uploadSurveys(List<Map<String, dynamic>> surveys) async {
  final response = await http.post(
    Uri.parse('$baseUrl/sync/uploads'),
    headers: {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    },
    body: jsonEncode({'surveys': surveys}),
  );
  
  if (response.statusCode != 200) {
    throw Exception('Upload failed: ${response.statusCode}');
  }
  
  final json = jsonDecode(response.body);
  return List<Map<String, dynamic>>.from(json['results']);
}
```

---

## Schemaless Form System

### How It Works

The system is designed to handle completely different form structures without requiring schema changes:

1. **Form Templates**: Each form template has a `schema` JSONB field containing:
   ```json
   {
     "fields": [
       {
         "name": "firstName",
         "label": "First Name", 
         "type": "Text",
         "required": true
       },
       {
         "name": "household_head",
         "label": "Head of Household",
         "type": "Text", 
         "required": true
       },
       {
         "name": "water_source",
         "label": "Water Source",
         "type": "Dropdown",
         "options": ["well", "tap", "river"],
         "required": false
       }
     ]
   }
   ```

2. **Dynamic Validation**: The system generates JSON schemas from form templates and validates responses using AJV

3. **Raw Data Storage**: All survey responses are stored as-is in the `data` JSONB field of `form_responses`

4. **Field Mapping**: The `storageMapping` tells the system how to extract specific information:
   - **PII Fields**: For beneficiary creation
   - **Service Fields**: For service delivery records
   - **Entity Fields**: For project/subproject associations

### Example: Different Form Types

**Health Survey Form**:
```json
{
  "blood_pressure": "120/80",
  "weight": 70,
  "temperature": 36.5,
  "medications": ["insulin", "metformin"]
}
```

**Household Survey Form**:
```json
{
  "household_head": "John Doe",
  "members_count": 4,
  "water_source": "well",
  "electricity": true
}
```

Both are stored in the same `data` field structure, with different `storageMapping` configurations to extract relevant information.

---

## Safeguards & Data Protection

### Local Database (Per-User)
- Each user has a **dedicated local database** containing only their assigned data
- User **cannot delete or reset** the local database until all pending surveys are uploaded and manifests received
- User **cannot logout** until the sync queue is empty and all manifests are confirmed
- Local database is **encrypted** using device-specific keys for PII protection

### Idempotency & Conflict Resolution
- Each survey upload includes a **unique `clientRequestId`** (Flutter-generated UUID)
- Backend maintains a **manifest registry** to prevent duplicate processing
- If the same `clientRequestId` is received twice, the backend returns the **original manifest ID**
- Flutter must **track upload status** and avoid resending already processed surveys

### Purge Policy & Data Retention
- **After manifest confirmation**: Local survey data may be purged, but minimal metadata is retained
- **Retained metadata**: `clientRequestId`, `manifestId`, `timestamp`, and `status` for audit purposes
- **PII handling**: Encrypted PII data is purged immediately after successful upload
- **Audit trail**: Local logs are maintained for debugging and compliance

### Schema Evolution & Compatibility
- **Form schema changes**: Backend must accept old survey formats or reject gracefully with clear error messages
- **Version detection**: Flutter can detect schema changes via `meta.schemaVersion` in datadump
- **Migration support**: Backend provides migration hints for deprecated field mappings
- **Graceful degradation**: Unknown form fields are ignored rather than causing upload failures

---

## Typical Flutter Offline Flow

1. **Authentication**: User logs in and receives JWT token
2. **Initial datadump**: Call `GET /sync/datadump` and store complete dataset locally
3. **Offline surveys**: User conducts surveys using form definitions from datadump
4. **Queue management**: Store completed surveys locally with unique `clientRequestId`
5. **Reconnect & upload**: When online, call `POST /sync/uploads` with queued surveys
6. **Manifest processing**: Process response manifests and update local status
7. **Data cleanup**: Purge successfully uploaded surveys while retaining audit metadata
8. **Logout allowed**: Only after all surveys are uploaded and manifests confirmed

### Error Recovery
- **Network failures**: Retry uploads with exponential backoff
- **Validation errors**: Fix survey data locally and retry
- **RBAC violations**: Remove inaccessible surveys from queue
- **Server errors**: Implement circuit breaker pattern for repeated failures

---

## Security & Privacy

- **Authentication**: JWT required for all endpoints
- **RBAC**: Strictly enforced for all entities by server
- **PII Protection**: 
  - Encrypted PII in datadump response
  - Local PII encryption using device keys
  - Immediate PII purging after successful upload
- **Data Integrity**: 
  - Manifest-based confirmation system
  - Idempotency prevents data corruption
  - Audit trails for compliance

---

## Flutter Implementation Notes

### Local Storage
- Use **SQLite** for local data storage (sqflite package)
- Implement **encryption** for sensitive data (flutter_secure_storage)
- Use **background processing** for large datadump imports
- Implement **progress indicators** for long-running operations

### Network Handling
- Implement **retry logic** with exponential backoff
- Use **circuit breaker** pattern for repeated failures
- Handle **network state changes** gracefully
- Implement **offline queue** with persistent storage

### Data Validation
- **Validate survey data** against form schemas before upload
- **Check RBAC permissions** before including surveys in upload batch
- **Verify data integrity** after datadump import
- **Handle schema changes** gracefully with user notifications

---

## Versioning & Compatibility

- **API Versioning**: Implicit versioning with backend releases
- **Schema Detection**: Use `meta.schemaVersion` for compatibility checks
- **Migration Support**: Backend provides migration hints for deprecated features
- **Graceful Degradation**: Unknown fields are ignored, not rejected

---

## References

- **Routes**: `src/routes/sync/sync.ts`
- **Controller**: `src/controllers/syncService.ts` (`dataDump`, `upload`)
- **Models**: `src/models/index.ts`
- **Storage Mapping**: Form templates include `storageMapping` metadata
- **RBAC**: User permissions enforced via `allowedProgramIds`
