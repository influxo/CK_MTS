/**
 * System role constants
 * These constants define the standard roles available in the system
 */
export const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  SYSTEM_ADMINISTRATOR: 'System Administrator',
  PROGRAM_MANAGER: 'Program Manager',
  SUB_PROJECT_MANAGER: 'Sub-Project Manager',
  FIELD_OPERATOR: 'Field Operator'
};

/**
 * Permission resource constants
 */
export const RESOURCES = {
  USER: 'user',
  ROLE: 'role',
  PERMISSION: 'permission',
  PROJECT: 'project',
  REPORT: 'report',
  BENEFICIARY: 'beneficiary',
  ACTIVITY: 'activity',
  DOCUMENT: 'document'
};

/**
 * Permission action constants
 */
export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage'
};

export default {
  ROLES,
  RESOURCES,
  ACTIONS
};
