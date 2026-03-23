import { ROLES } from "../constants/roles";

/**
 * Protected roles that cannot be assigned through the interface.
 * The SuperAdmin role is reserved for database seeding only.
 */
export const PROTECTED_ROLES = [ROLES.SUPER_ADMIN] as const;

/**
 * Check if a role name is protected (cannot be assigned via interface)
 */
export function isProtectedRole(roleName: string): boolean {
  return PROTECTED_ROLES.includes(roleName as (typeof PROTECTED_ROLES)[number]);
}

/**
 * Filter out protected roles from a list of role objects
 * Returns only roles that can be assigned through the interface
 */
export function filterAssignableRoles<T extends { name: string }>(
  roles: T[],
): T[] {
  return roles.filter((role) => !isProtectedRole(role.name));
}

/**
 * Validate that none of the provided role IDs correspond to protected roles
 * @param roleIds - Array of role IDs to validate
 * @throws Error if any protected role is found
 */
export async function validateNoProtectedRoles(
  roleIds: string[],
): Promise<void> {
  const { Role } = await import("../models");
  const roles = await Role.findAll({
    where: { id: { [require("sequelize").Op.in]: roleIds } },
    attributes: ["id", "name"],
  });

  const protectedFound = roles.filter((r) => isProtectedRole(r.name));
  if (protectedFound.length > 0) {
    const protectedNames = protectedFound.map((r) => r.name).join(", ");
    throw new Error(
      `Cannot assign protected role(s): ${protectedNames}. These roles are reserved for system use only.`,
    );
  }
}

export default {
  PROTECTED_ROLES,
  isProtectedRole,
  filterAssignableRoles,
  validateNoProtectedRoles,
};
