import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Role, Permission, RolePermission } from '../../models';
import User, { UserWithRoles } from '../../models/User';
import { ROLES, RESOURCES, ACTIONS } from '../../constants/roles';
import sequelize from '../connection';
import { seedProjectsBeneficiaries } from './seedProjectsBeneficiaries';

/**
 * Create default roles and permissions in the database
 */
async function createRolesAndPermissions() {
  console.log('Creating roles and permissions...');
  
  // Create all permissions based on resources and actions
  const permissions: Permission[] = [];
  
  for (const resource of Object.values(RESOURCES)) {
    for (const action of Object.values(ACTIONS)) {
      // Generate a unique name for the permission
      const permissionName = `${action}_${resource}`;
      
      const [permission] = await Permission.findOrCreate({
        where: {
          resource,
          action
        },
        defaults: {
          id: uuidv4(),
          name: permissionName,
          resource,
          action,
          description: `Permission to ${action} ${resource}`
        }
      });
      
      permissions.push(permission);
    }
  }
  
  console.log(`Created ${permissions.length} permissions`);
  
  // Create roles
  const roles: { [key: string]: Role } = {};
  
  for (const roleName of Object.values(ROLES)) {
    const [role] = await Role.findOrCreate({
      where: { name: roleName },
      defaults: {
        id: uuidv4(),
        name: roleName,
        description: `${roleName} role`
      }
    });
    
    roles[roleName] = role;
  }
  
  console.log(`Created ${Object.keys(roles).length} roles`);
  
  // Assign permissions to roles
  
  // SuperAdmin gets all permissions
  await assignAllPermissionsToRole(roles[ROLES.SUPER_ADMIN], permissions);
  
  // System Administrator gets most permissions except some sensitive ones
  const systemAdminPermissions = permissions.filter(p => 
    !(p.resource === RESOURCES.PERMISSION && p.action === ACTIONS.DELETE)
  );
  await assignPermissionsToRole(roles[ROLES.SYSTEM_ADMINISTRATOR], systemAdminPermissions);
  
  // Program Manager gets project management permissions
  const programManagerPermissions = permissions.filter(p => 
    (p.resource === RESOURCES.PROJECT && [ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.MANAGE].includes(p.action)) ||
    (p.resource === RESOURCES.REPORT && [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE].includes(p.action)) ||
    (p.resource === RESOURCES.BENEFICIARY && [ACTIONS.READ].includes(p.action)) ||
    (p.resource === RESOURCES.ACTIVITY && [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE].includes(p.action)) ||
    (p.resource === RESOURCES.DOCUMENT && [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.UPDATE].includes(p.action))
  );
  await assignPermissionsToRole(roles[ROLES.PROGRAM_MANAGER], programManagerPermissions);
  
  // Sub-Project Manager gets limited project permissions
  const subProjectManagerPermissions = permissions.filter(p => 
    (p.resource === RESOURCES.PROJECT && [ACTIONS.READ].includes(p.action)) ||
    (p.resource === RESOURCES.REPORT && [ACTIONS.CREATE, ACTIONS.READ].includes(p.action)) ||
    (p.resource === RESOURCES.BENEFICIARY && [ACTIONS.READ, ACTIONS.CREATE].includes(p.action)) ||
    (p.resource === RESOURCES.ACTIVITY && [ACTIONS.READ, ACTIONS.CREATE].includes(p.action)) ||
    (p.resource === RESOURCES.DOCUMENT && [ACTIONS.READ, ACTIONS.CREATE].includes(p.action))
  );
  await assignPermissionsToRole(roles[ROLES.SUB_PROJECT_MANAGER], subProjectManagerPermissions);
  
  // Field Operator gets basic permissions
  const fieldOperatorPermissions = permissions.filter(p => 
    (p.resource === RESOURCES.BENEFICIARY && [ACTIONS.READ, ACTIONS.CREATE].includes(p.action)) ||
    (p.resource === RESOURCES.ACTIVITY && [ACTIONS.READ].includes(p.action)) ||
    (p.resource === RESOURCES.DOCUMENT && [ACTIONS.READ].includes(p.action))
  );
  await assignPermissionsToRole(roles[ROLES.FIELD_OPERATOR], fieldOperatorPermissions);
  
  return roles;
}

/**
 * Assign all permissions to a role
 */
async function assignAllPermissionsToRole(role: Role, permissions: Permission[]) {
  console.log(`Assigning all permissions to ${role.name}...`);
  
  for (const permission of permissions) {
    await RolePermission.findOrCreate({
      where: {
        roleId: role.id,
        permissionId: permission.id
      },
      defaults: {
        roleId: role.id,
        permissionId: permission.id
      }
    });
  }
}

/**
 * Assign specific permissions to a role
 */
async function assignPermissionsToRole(role: Role, permissions: Permission[]) {
  console.log(`Assigning ${permissions.length} permissions to ${role.name}...`);
  
  for (const permission of permissions) {
    await RolePermission.findOrCreate({
      where: {
        roleId: role.id,
        permissionId: permission.id
      },
      defaults: {
        roleId: role.id,
        permissionId: permission.id
      }
    });
  }
}

/**
 * Create default users in the database
 */
async function createDefaultUsers(roles: { [key: string]: Role }) {
  console.log('Creating default users...');
  
  // Create a user for each role
  const users = [
    {
      firstName: 'Super',
      lastName: 'Admin',
      email: 'superadmin@example.com',
      password: 'Hello!@#1',
      status: 'active',
      emailVerified: true,
      role: ROLES.SUPER_ADMIN
    }
  ];
  
  for (const userData of users) {
    const { firstName, lastName, email, password, status, emailVerified, role } = userData;
    
    // Create or update the user - the User model will hash the password automatically
    const [user] = await User.findOrCreate({
      where: { email },
      defaults: {
        id: uuidv4(),
        firstName,
        lastName,
        email,
        password, // Let the model handle password hashing
        status,
        emailVerified
      }
    });
    
    // Assign role to user
    await user.addRole(roles[role]);
    
    console.log(`Created user: ${firstName} ${lastName} (${email}) with role: ${role}`);
  }
}

/**
 * Main seed function
 */
export async function seed() {
  try {
    // Use a transaction to ensure data consistency
    await sequelize.transaction(async (transaction) => {
      const roles = await createRolesAndPermissions();
      await createDefaultUsers(roles);
    });
    console.log('Seed completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
}

// Execute the seed function if this script is run directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seed script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed script failed:', error);
      process.exit(1);
    });
}
