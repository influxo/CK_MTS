# Employee CRUD and Invitation Hierarchy

## Overview

This document outlines the hierarchical permissions for Employee CRUD operations and user invitations in the Caritas Kosova system. Only **SuperAdmin** and **System Administrator** roles can manage (invite, update, delete) employees, with hierarchy restrictions to prevent managing users at the same or higher privilege level.

## Role Hierarchy

The system follows this hierarchical structure (highest to lowest):

1. **SuperAdmin** - Highest privilege level
2. **System Administrator**
3. **Program Manager**
4. **Sub-Project Manager**
5. **Field Operator**

## Employee Management Permissions

### Who Can Manage Employees (Invite, Update, Delete)

| Role | Can Manage | Cannot Manage |
|------|------------|---------------|
| **SuperAdmin** | All roles (SuperAdmin, System Administrator, Program Manager, Sub-Project Manager, Field Operator) | None |
| **System Administrator** | Program Manager, Sub-Project Manager, Field Operator | SuperAdmin, System Administrator |
| **Program Manager** | None | All roles |
| **Sub-Project Manager** | None | All roles |
| **Field Operator** | None | All roles |

### Management Rules

```
SuperAdmin → Can manage: [SuperAdmin, System Administrator, Program Manager, Sub-Project Manager, Field Operator]
System Administrator → Can manage: [System Administrator, Program Manager, Sub-Project Manager, Field Operator]
Program Manager → Can manage: [] (read-only access within project scope)
Sub-Project Manager → Can manage: [] (read-only access within subproject scope)
Field Operator → Can manage: [] (read-only access based on assignments)
```

## CRUD Operation Permissions

### Create (Invite)

| Inviter Role | Can Invite | Cannot Invite |
|--------------|------------|---------------|
| **SuperAdmin** | All roles | None |
| **System Administrator** | Program Manager, Sub-Project Manager, Field Operator | SuperAdmin, System Administrator |
| **Program Manager** | None | All roles |
| **Sub-Project Manager** | None | All roles |
| **Field Operator** | None | All roles |

### Read (View Users)

| Role | Can View |
|------|----------|
| **SuperAdmin** | All users |
| **System Administrator** | All users except SuperAdmin |
| **Program Manager** | Users within their project scope |
| **Sub-Project Manager** | Users within their subproject scope |
| **Field Operator** | Limited view based on assignments |

### Update

| Updater Role | Can Update | Cannot Update |
|--------------|------------|---------------|
| **SuperAdmin** | All roles | None |
| **System Administrator** | Program Manager, Sub-Project Manager, Field Operator | SuperAdmin, System Administrator |
| **Program Manager** | None | All roles |
| **Sub-Project Manager** | None | All roles |
| **Field Operator** | None | All roles |

### Delete (Archive)

| Deleter Role | Can Archive | Cannot Archive |
|--------------|-------------|----------------|
| **SuperAdmin** | All roles | None |
| **System Administrator** | System Administrator, Program Manager, Sub-Project Manager, Field Operator | SuperAdmin |
| **Program Manager** | None | All roles |
| **Sub-Project Manager** | None | All roles |
| **Field Operator** | None | All roles |

## Implementation Status

### ✅ Implemented

1. **Delete Function** (`deleteUser`):
   - SuperAdmin can delete any user
   - System Administrator can delete System Administrator, Program Manager, Sub-Project Manager, Field Operator
   - System Administrator CANNOT delete SuperAdmin
   - Only SuperAdmin and System Administrator can delete users

2. **Update Function** (`updateUser`):
   - SuperAdmin can update any user
   - System Administrator can update Program Manager, Sub-Project Manager, Field Operator
   - System Administrator CANNOT update SuperAdmin
   - Only SuperAdmin and System Administrator can update users

3. **Invite Function** (`inviteUser`):
   - SuperAdmin can invite any role
   - System Administrator can invite Program Manager, Sub-Project Manager, Field Operator
   - System Administrator CANNOT invite SuperAdmin or System Administrator
   - Only SuperAdmin and System Administrator can invite users

4. **Route Authorization**:
   - DELETE `/users/:id` - Authorized for SuperAdmin and System Administrator
   - PUT `/users/:id` - Authorized for SuperAdmin and System Administrator
   - POST `/users/invite` - Authorized for SuperAdmin and System Administrator
   - PUT `/users/:id/roles` - Authorized for SuperAdmin and System Administrator

## Implementation Summary

All employee CRUD and invitation hierarchy restrictions have been implemented:

### Delete Function ✅
- Role hierarchy validation implemented
- SuperAdmin can delete anyone
- System Administrator can delete anyone except SuperAdmin
- Other roles cannot delete anyone

### Update Function ✅
- Role hierarchy validation implemented  
- SuperAdmin can update anyone
- System Administrator can update anyone except SuperAdmin
- Other roles cannot update anyone

### Invite Function ✅
- Role hierarchy validation implemented
- SuperAdmin can invite any role
- System Administrator can invite Program Manager, Sub-Project Manager, Field Operator
- System Administrator CANNOT invite SuperAdmin or System Administrator
- Other roles cannot invite anyone

### Route Authorization ✅
- All employee management routes restricted to SuperAdmin and System Administrator only

## API Routes

| Route | Method | Authorized Roles | Description |
|-------|--------|------------------|-------------|
| `/users/invite` | POST | SuperAdmin, System Administrator | Invite new employee |
| `/users/:id` | PUT | System Administrator | Update employee |
| `/users/:id` | DELETE | SuperAdmin, System Administrator | Archive employee |
| `/users/:id/roles` | PUT | SuperAdmin, System Administrator | Update employee roles |
| `/users` | GET | Authenticated | List users (with hierarchical filtering) |

## Testing Scenarios

### Invitation Tests

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | SuperAdmin invites SuperAdmin | ✅ Success |
| 2 | SuperAdmin invites System Administrator | ✅ Success |
| 3 | SuperAdmin invites Program Manager | ✅ Success |
| 4 | System Administrator invites System Administrator | ❌ 403 Forbidden |
| 5 | System Administrator invites SuperAdmin | ❌ 403 Forbidden |
| 6 | System Administrator invites Program Manager | ✅ Success |
| 7 | System Administrator invites Sub-Project Manager | ✅ Success |
| 8 | System Administrator invites Field Operator | ✅ Success |
| 9 | Program Manager invites anyone | ❌ 403 Forbidden |
| 10 | Sub-Project Manager invites anyone | ❌ 403 Forbidden |
| 11 | Field Operator invites anyone | ❌ 403 Forbidden |

### Update Tests

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | SuperAdmin updates SuperAdmin | ✅ Success |
| 2 | SuperAdmin updates System Administrator | ✅ Success |
| 3 | SuperAdmin updates Program Manager | ✅ Success |
| 4 | System Administrator updates System Administrator | ✅ Success |
| 5 | System Administrator updates SuperAdmin | ❌ 403 Forbidden |
| 6 | System Administrator updates Program Manager | ✅ Success |
| 7 | System Administrator updates Sub-Project Manager | ✅ Success |
| 8 | System Administrator updates Field Operator | ✅ Success |
| 9 | Program Manager updates anyone | ❌ 403 Forbidden |
| 10 | Sub-Project Manager updates anyone | ❌ 403 Forbidden |
| 11 | Field Operator updates anyone | ❌ 403 Forbidden |

### Delete Tests

| # | Scenario | Expected Result |
|---|----------|-----------------|
| 1 | SuperAdmin deletes SuperAdmin | ✅ Success |
| 2 | SuperAdmin deletes System Administrator | ✅ Success |
| 3 | SuperAdmin deletes Program Manager | ✅ Success |
| 4 | System Administrator deletes System Administrator | ✅ Success |
| 5 | System Administrator deletes SuperAdmin | ❌ 403 Forbidden |
| 6 | System Administrator deletes Program Manager | ✅ Success |
| 7 | System Administrator deletes Sub-Project Manager | ✅ Success |
| 8 | System Administrator deletes Field Operator | ✅ Success |
| 9 | Program Manager deletes anyone | ❌ 403 Forbidden |
| 10 | Sub-Project Manager deletes anyone | ❌ 403 Forbidden |
| 11 | Field Operator deletes anyone | ❌ 403 Forbidden |

## Notes

- Only **SuperAdmin** and **System Administrator** can perform CRUD operations on employees
- **SuperAdmin** has full access to manage all users including other SuperAdmins
- **System Administrator** can manage all roles except SuperAdmin (including other System Administrators)
- All hierarchy checks happen **after** authentication but **before** any database modifications
- Audit logging should capture hierarchy violation attempts

## Related Files

- `src/controllers/users/index.ts` - Main user CRUD and invitation logic
- `src/routes/userRoutes/users.ts` - API route definitions
- `src/utils/protectedRoles.ts` - Protected role validation
- `src/constants/roles.ts` - Role constants
- `src/models/User.ts` - User model
- `src/models/Role.ts` - Role model
- `src/models/UserRole.ts` - User-Role relationship
