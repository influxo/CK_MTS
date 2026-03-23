# Caritas Kosova & Mother Teresa Society Data Management Platform

## Project Overview

This is a full-stack data management platform developed for **Caritas Kosova (CK)** and **Mother Teresa Society (MTS)**. The system centralizes program-related data, facilitates offline data collection, enables real-time monitoring, and provides reporting and analysis tools for humanitarian aid programs.

### Architecture

- **Backend**: Node.js + Express + TypeScript + Sequelize ORM
- **Database**: PostgreSQL 15
- **Frontend**: React (UI folder - separate setup)
- **Authentication**: JWT-based with RBAC (Role-Based Access Control) and 2FA (TOTP)
- **Data Security**: AES-256 encryption at rest for beneficiary PII, TLS in transit
- **Deployment**: Docker + Docker Compose

### Core Features

- **User Management**: RBAC with 5-tier hierarchy (SuperAdmin → System Administrator → Program Manager → Sub-Project Manager → Field Operator)
- **Program Management**: Multi-tier hierarchy (Project → Subproject → Activity)
- **Beneficiary Management**: Encrypted PII storage, matching keys, assignments
- **Forms System**: Dynamic form templates, responses, KPI tracking
- **Service Delivery**: Service assignments and delivery tracking
- **Offline Support**: Sync service for Flutter mobile apps
- **Audit Logging**: Comprehensive action tracking
- **Dashboard & Reporting**: Analytics and statistics

## Repository Structure

```
CK_MTS/
├── API/                          # Backend API (Node.js/TypeScript)
│   ├── src/
│   │   ├── controllers/          # Request handlers
│   │   ├── models/               # Sequelize models (28 entities)
│   │   ├── routes/               # Express routers
│   │   ├── middlewares/          # Auth, logger, validation
│   │   ├── services/             # Business logic
│   │   ├── utils/                # Helpers (mailer, crypto, mfa)
│   │   ├── templates/            # Email templates
│   │   ├── constants/            # Role constants, cities, etc.
│   │   ├── db/                   # Database connection & seeds
│   │   ├── config/               # Swagger, env config
│   │   └── index.ts              # Entry point
│   ├── docs/                     # Documentation
│   ├── tests/                    # Jest tests
│   ├── package.json
│   ├── tsconfig.json
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── .env.example
├── UI/
│   └── CK_MTS_FRONTEND/          # React frontend (empty placeholder)
└── QWEN.md                       # This file
```

## Building and Running

### Prerequisites

- Node.js v16+ (v18 recommended)
- PostgreSQL v12+ (v15 recommended)
- npm or yarn

### Local Development (API)

1. **Navigate to API directory**:
   ```bash
   cd API
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Run development server** (with auto-reload):
   ```bash
   npm run dev
   ```

5. **Seed database** (optional - runs automatically on first start):
   ```bash
   npm run seed
   ```

### Docker Deployment

1. **Navigate to API directory**:
   ```bash
   cd API
   ```

2. **Start all services** (PostgreSQL + API):
   ```bash
   docker-compose up -d
   ```

3. **View logs**:
   ```bash
   docker-compose logs -f
   ```

4. **Stop services**:
   ```bash
   docker-compose down
   ```

**Docker Services**:
| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| PostgreSQL | `ck-mts-postgres` | 5437:5432 | Database |
| API | `ck-mts-app` | 3010:3010 | Node.js application |

### Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with ts-node-dev (auto-reload) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server (requires build first) |
| `npm run lint` | Run ESLint |
| `npm test` | Run Jest tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run seed` | Seed database with roles, permissions, users |

## API Endpoints

Base URL: `http://localhost:3010/api`

| Endpoint | Description | Auth Required |
|----------|-------------|---------------|
| `/health` | Health check | No |
| `/auth/*` | Authentication (login, 2FA, password reset) | No |
| `/users/*` | User management (CRUD, invitations) | Yes |
| `/users/me` | Current user profile | Yes |
| `/users/my-team` | Team members (hierarchical) | Yes |
| `/users/my-beneficiaries` | Beneficiaries (hierarchical) | Yes |
| `/roles/*` | Role management | Yes |
| `/permissions/*` | Permission management | Yes |
| `/projects/*` | Project management | Yes |
| `/subprojects/*` | Subproject management | Yes |
| `/activities/*` | Activity management | Yes |
| `/beneficiaries/*` | Beneficiary management (encrypted PII) | Yes |
| `/forms/*` | Form templates & responses | Yes |
| `/services/*` | Service management | Yes |
| `/dashboard/*` | Dashboard data & summaries | Yes |
| `/logs/*` | System logs | Yes |
| `/audit-logs/*` | Audit trail | Yes |
| `/sync/*` | Flutter offline sync | Yes |
| `/constants/*` | System constants (cities, roles) | Yes |

**API Documentation**: Available at `http://localhost:3010/api-docs` (Swagger UI)

## Database Models

### Core Entities (28 models)

| Model | Description |
|-------|-------------|
| `User` | User accounts with authentication |
| `Role` | System roles (5-tier hierarchy) |
| `Permission` | Granular permissions (resource + action) |
| `UserRole` | User-Role many-to-many join table |
| `RolePermission` | Role-Permission many-to-many join table |
| `Project` | Top-level programs |
| `Subproject` | Child of Project |
| `Activity` | Child of Subproject |
| `ProjectUser`, `SubprojectUser`, `ActivityUser` | Entity-User assignments |
| `Beneficiary` | Beneficiary records (encrypted PII) |
| `BeneficiaryDetails` | Extended beneficiary info |
| `BeneficiaryAssignment` | Beneficiary-Entity assignments |
| `BeneficiaryMatchKey` | Matching keys for deduplication |
| `BeneficiaryMapping` | Form-to-beneficiary mapping |
| `FormTemplate` | Dynamic form definitions |
| `FormField` | Form field definitions |
| `FormResponse` | Submitted form data |
| `Kpi` | KPI definitions linked to form fields |
| `Service` | Service definitions |
| `ServiceAssignment` | Service-Entity assignments |
| `ServiceDelivery` | Service delivery records |
| `AuditLog` | System audit trail |
| `Log` | Application logs |
| `MfaTempToken` | 2FA temporary tokens |

### Key Relationships

```
Project 1──N Subproject 1──N Activity
   │              │              │
   N              N              N
User (via join tables: ProjectUser, SubprojectUser, ActivityUser)

FormTemplate 1──N FormResponse 1──N ServiceDelivery
      │              │                    │
      1              1                    1
BeneficiaryMapping  Beneficiary ────────┘

User 1──N UserRole N──1 Role N──N RolePermission N──1 Permission
```

## Security & Authentication

### Role Hierarchy

| Role | Level | Can Manage |
|------|-------|------------|
| SuperAdmin | 5 | All roles including SuperAdmin |
| System Administrator | 4 | Program Manager, Sub-Project Manager, Field Operator |
| Program Manager | 3 | Sub-Project Manager, Field Operator |
| Sub-Project Manager | 2 | Field Operator |
| Field Operator | 1 | None |

### Authentication Flow

1. **Login**: Email + password → JWT token
2. **2FA** (optional): TOTP code verification
3. **Authorization**: JWT decoded → user roles/permissions attached to request
4. **Middleware**: `authenticate()` → `authorize(requiredRoles)` → `hasPermission(resource, action)`

### Protected Roles

- `SuperAdmin` is a **protected role** - cannot be assigned via API (except by another SuperAdmin)
- Validation in `src/utils/protectedRoles.ts`

### Data Encryption

- **Beneficiary PII**: AES-256 encryption using `BENEFICIARY_ENC_KEY`
- **Passwords**: bcrypt hashing (10 rounds)
- **JWT**: Signed with `JWT_SECRET`
- **PII Fields**: firstName, lastName, dob, gender, address, municipality, nationality, ethnicity, residence, householdMembers, nationalId, phone, email

## Default Users (After Seeding)

| Email | Password | Role |
|-------|----------|------|
| superadmin@example.com | Hello!@#1 | SuperAdmin |
| sysadmin@example.com | Hello!@#1 | System Administrator |
| program@example.com | Hello!@#1 | Program Manager |
| subproject@example.com | Hello!@#1 | Sub-Project Manager |
| field@example.com | Hello!@#1 | Field Operator |

## Development Conventions

### Code Style

- **Language**: TypeScript (strict mode enabled)
- **Module System**: CommonJS
- **Target**: ES2020
- **Formatting**: Standard TypeScript conventions
- **Naming**: camelCase for variables/functions, PascalCase for classes/types

### Testing Practices

- **Framework**: Jest + ts-jest
- **Test Files**: `*.test.ts` in `src/tests/` or alongside source files
- **Timeout**: 10 seconds per test
- **Coverage**: Reports generated in `coverage/` directory
- **Test Command**: `npm test` or `npm run test:coverage`

### Git Workflow

- Feature branches for new development
- Commit messages should be clear and descriptive
- Pull requests for code review

### Environment Variables

Required in `.env`:

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=caritas
DB_USER=postgres
DB_PASSWORD=yourpassword

# Security
JWT_SECRET=your_jwt_secret_key
BENEFICIARY_ENC_KEY=your_32_byte_key_here

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
EMAIL_USER=you@example.com
EMAIL_PASS=your_email_password

# Frontend Integration
FRONTEND_URL=http://localhost:5173
FRONTEND_ACCEPT_INVITE_URL=http://localhost:5173/accept-invitation
```

## Key Implementation Notes

### User Invitation Flow

1. Admin invites user via `/users/invite`
2. System creates user with status=`invited`, generates verification token
3. Invitation email sent with accept link
4. User clicks link → verifies email → sets password → status=`active`

### Hierarchy Enforcement

Currently implemented:
- ✅ SuperAdmin protection in update/delete/password reset
- ✅ Protected role validation (SuperAdmin cannot be assigned via interface)

Missing (documented in `docs/employee-crud-invitation-hierarchy.md`):
- ❌ Full hierarchy validation for invitations (same-level restrictions)
- ❌ Hierarchy validation for updates/deletes across all levels
- ❌ Hierarchical filtering in user listing

### Offline Sync

- Sync service (`/api/sync/*`) designed for Flutter mobile apps
- Supports delta sync for offline data collection
- Uses SQLite on mobile, PostgreSQL on backend

## Related Documentation

- `API/README.md` - General API documentation
- `API/DOCKER_README.md` - Docker deployment guide
- `API/docs/employee-crud-invitation-hierarchy.md` - Role hierarchy & permissions spec
- `API/docs/swagger.json` - OpenAPI specification (auto-generated)

## License

Proprietary and confidential. © 2025 Influxo SH.P.K & Besart Vllahinja B.I (Contractors)
