# Forms Module Documentation

The Forms module is a dynamic, schema-based system for creating, managing, and submitting customizable forms within the Caritas Kosova/Mother Teresa Society platform. This document provides comprehensive information on how to use the Forms API, run migrations, and integrate with the module.

## Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Authentication and Authorization](#authentication-and-authorization)
5. [Validation](#validation)
6. [Audit Logging](#audit-logging)
7. [Migration Guide](#migration-guide)
8. [Examples](#examples)

## Overview

The Forms module enables:

- Creation and management of form templates with versioning
- Dynamic JSON Schema validation for form responses
- GPS location data collection with form submissions
- Pagination and date filtering for form responses
- Audit logging of all form-related actions
- Role-based access control (RBAC) enforcement

## Database Schema

The module uses two main tables:

### form_templates

| Column      | Type         | Description                             |
|-------------|--------------|-----------------------------------------|
| id          | UUID         | Primary key                             |
| name        | VARCHAR(255) | Name of the form template               |
| programId  | UUID         | Associated program ID (foreign key)     |
| schema      | JSONB        | Form schema definition                  |
| version     | INTEGER      | Version number, increments on update    |
| created_at  | TIMESTAMP    | Creation timestamp                      |
| updated_at  | TIMESTAMP    | Last update timestamp                   |
| deleted_at  | TIMESTAMP    | Soft delete timestamp (null if active)  |

**Indexes:**
- Primary key on `id`
- Composite unique index on `(programId, name, version)` 
- GIN index on `schema` JSONB column

### form_responses

| Column           | Type          | Description                            |
|------------------|---------------|----------------------------------------|
| id               | UUID          | Primary key                            |
| form_template_id | UUID          | Form template ID (foreign key)         |
| programId       | UUID          | Associated program ID (foreign key)    |
| submitted_by     | UUID          | User ID who submitted the form         |
| data             | JSONB         | Form response data                     |
| latitude         | DECIMAL(9,6)  | Optional GPS latitude coordinate       |
| longitude        | DECIMAL(9,6)  | Optional GPS longitude coordinate      |
| submitted_at     | TIMESTAMP     | Submission timestamp                   |
| created_at       | TIMESTAMP     | Creation timestamp                     |
| updated_at       | TIMESTAMP     | Last update timestamp                  |

**Indexes:**
- Primary key on `id`
- Foreign key index on `form_template_id`
- Foreign key index on `programId`
- Foreign key index on `submitted_by`
- GIN index on `data` JSONB column
- Index on `submitted_at` for date range filtering

## API Endpoints

### Form Templates

#### Get Form Templates by Program

```
GET /api/forms/templates?programId={uuid}&page={number}&limit={number}
```

**Parameters:**
- `programId` (required): UUID of the program
- `page` (optional, default: 1): Page number for pagination
- `limit` (optional, default: 20): Number of items per page

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Form Template Name",
      "programId": "program-uuid",
      "schema": { /* JSON schema object */ },
      "version": 1,
      "createdAt": "2025-07-24T20:00:00.000Z",
      "updatedAt": "2025-07-24T20:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "totalItems": 1
  }
}
```

#### Get Form Template by ID

```
GET /api/forms/templates/{templateId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Form Template Name",
    "programId": "program-uuid",
    "schema": { /* JSON schema object */ },
    "version": 1,
    "createdAt": "2025-07-24T20:00:00.000Z",
    "updatedAt": "2025-07-24T20:00:00.000Z"
  }
}
```

#### Create Form Template

```
POST /api/forms/templates
```

**Request Body:**
```json
{
  "name": "Form Template Name",
  "programId": "program-uuid",
  "schema": { 
    "title": "Sample Form",
    "type": "object",
    "properties": {
      "name": {
        "type": "string",
        "title": "Full Name"
      },
      "age": {
        "type": "integer",
        "title": "Age",
        "minimum": 0
      }
    },
    "required": ["name"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Form template created successfully",
  "data": {
    "id": "new-uuid",
    "name": "Form Template Name",
    "programId": "program-uuid",
    "schema": { /* JSON schema object */ },
    "version": 1,
    "createdAt": "2025-07-24T20:00:00.000Z",
    "updatedAt": "2025-07-24T20:00:00.000Z"
  }
}
```

#### Update Form Template

```
PUT /api/forms/templates/{templateId}
```

**Request Body:**
```json
{
  "name": "Updated Form Template Name",
  "schema": { /* Updated JSON schema object */ }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Form template updated successfully",
  "data": {
    "id": "uuid",
    "name": "Updated Form Template Name",
    "programId": "program-uuid",
    "schema": { /* Updated JSON schema object */ },
    "version": 2,
    "createdAt": "2025-07-24T20:00:00.000Z",
    "updatedAt": "2025-07-24T20:30:00.000Z"
  }
}
```

#### Delete Form Template

```
DELETE /api/forms/templates/{templateId}
```

**Response:**
```json
{
  "success": true,
  "message": "Form template deleted successfully"
}
```

### Form Responses

#### Submit Form Response

```
POST /api/forms/templates/{templateId}/responses
```

**Request Body:**
```json
{
  "data": {
    "name": "John Doe",
    "age": 30
  },
  "latitude": 41.123456,
  "longitude": 20.654321
}
```

**Response:**
```json
{
  "success": true,
  "message": "Form response submitted successfully",
  "data": {
    "id": "new-uuid",
    "form_template_id": "template-uuid",
    "programId": "program-uuid",
    "submitted_by": "user-uuid",
    "data": {
      "name": "John Doe",
      "age": 30
    },
    "latitude": 41.123456,
    "longitude": 20.654321,
    "submitted_at": "2025-07-24T20:00:00.000Z",
    "createdAt": "2025-07-24T20:00:00.000Z",
    "updatedAt": "2025-07-24T20:00:00.000Z"
  }
}
```

#### Get Form Responses

```
GET /api/forms/templates/{templateId}/responses?page={number}&limit={number}&fromDate={date}&toDate={date}
```

**Parameters:**
- `page` (optional, default: 1): Page number for pagination
- `limit` (optional, default: 20): Number of items per page
- `fromDate` (optional): ISO date string to filter responses submitted after this date
- `toDate` (optional): ISO date string to filter responses submitted before this date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "form_template_id": "template-uuid",
      "programId": "program-uuid",
      "submitted_by": "user-uuid",
      "data": { /* Form response data */ },
      "latitude": 41.123456,
      "longitude": 20.654321,
      "submitted_at": "2025-07-24T20:00:00.000Z",
      "createdAt": "2025-07-24T20:00:00.000Z",
      "updatedAt": "2025-07-24T20:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "totalItems": 1
  }
}
```

## Authentication and Authorization

All Forms API endpoints require authentication via JWT tokens.

**Authorization rules:**
- **Creating/updating/deleting form templates**: Requires SUPER_ADMIN, SYSTEM_ADMINISTRATOR, PROGRAM_MANAGER, or SUB_PROJECT_MANAGER roles
- **Submitting form responses**: Requires SUPER_ADMIN, SYSTEM_ADMINISTRATOR, PROGRAM_MANAGER, SUB_PROJECT_MANAGER, or FIELD_OPERATOR roles
- **Viewing form templates and responses**: Requires SUPER_ADMIN, SYSTEM_ADMINISTRATOR, PROGRAM_MANAGER, SUB_PROJECT_MANAGER, or FIELD_OPERATOR roles

For non-admin roles, the user must have access to the program associated with the form (checked against `req.user.allowedProgramIds`).

## Validation

Form responses are validated against the form template's JSON Schema using AJV:

1. The system converts the stored schema to a valid JSON Schema (draft-07)
2. Input validation uses AJV with format validation support
3. Validation results include detailed error messages with field paths
4. Text fields are sanitized to prevent XSS attacks
5. Schemas are cached for performance optimization

## Audit Logging

The following actions are logged in the system:

- `FORM_TEMPLATE_CREATE`: When a new form template is created
- `FORM_TEMPLATE_UPDATE`: When a form template is updated
- `FORM_RESPONSE_SUBMIT`: When a form response is submitted
- `FORM_TEMPLATE_DELETE`: When a form template is deleted

All database operations and audit logging are wrapped in Sequelize transactions to ensure data integrity.

## Migration Guide

To apply the database migrations, run:

```bash
npx sequelize-cli db:migrate
```

This will create the `form_templates` and `form_responses` tables with appropriate indexes.

## Examples

### Creating a Simple Form Template

```javascript
// Example code to create a form template
const response = await fetch('/api/forms/templates', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    name: "Beneficiary Registration Form",
    programId: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    schema: {
      title: "Beneficiary Registration",
      type: "object",
      required: ["fullName", "dateOfBirth"],
      properties: {
        fullName: {
          type: "string",
          title: "Full Name",
          minLength: 2
        },
        dateOfBirth: {
          type: "string",
          format: "date",
          title: "Date of Birth"
        },
        gender: {
          type: "string",
          enum: ["male", "female", "other", "prefer_not_to_say"],
          title: "Gender"
        },
        address: {
          type: "object",
          title: "Address",
          properties: {
            street: { type: "string", title: "Street" },
            city: { type: "string", title: "City" },
            postalCode: { type: "string", title: "Postal Code" }
          }
        },
        phoneNumber: {
          type: "string",
          title: "Phone Number",
          pattern: "^[0-9+\\-\\s]+$"
        },
        email: {
          type: "string",
          format: "email",
          title: "Email Address"
        },
        needsAssessment: {
          type: "array",
          title: "Needs Assessment",
          items: {
            type: "string",
            enum: ["food", "shelter", "medical", "education", "other"]
          }
        },
        comments: {
          type: "string",
          title: "Additional Comments",
          maxLength: 500
        }
      }
    }
  })
});
```

### Submitting a Form Response with GPS Location

```javascript
// Example code to submit a form response with GPS coordinates
navigator.geolocation.getCurrentPosition(async (position) => {
  const { latitude, longitude } = position.coords;
  
  const response = await fetch(`/api/forms/templates/${templateId}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      data: {
        fullName: "John Doe",
        dateOfBirth: "1985-05-15",
        gender: "male",
        address: {
          street: "123 Main St",
          city: "Pristina",
          postalCode: "10000"
        },
        phoneNumber: "+383 44 123 456",
        email: "john.doe@example.com",
        needsAssessment: ["food", "medical"],
        comments: "Requires immediate food assistance"
      },
      latitude,
      longitude
    })
  });
});
```

### Fetching Form Responses with Date Filtering

```javascript
// Example code to get form responses with date filtering
const fromDate = new Date('2025-01-01').toISOString();
const toDate = new Date().toISOString();
const page = 1;
const limit = 20;

const response = await fetch(
  `/api/forms/templates/${templateId}/responses?page=${page}&limit=${limit}&fromDate=${fromDate}&toDate=${toDate}`, 
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
```
