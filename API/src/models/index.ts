import User from "./User";
import Role from "./Role";
import Permission from "./Permission";
import UserRole from "./UserRole";
import RolePermission from "./RolePermission";
import Log from "./Log";
import Project from "./Project";
import ProjectUser from "./ProjectUser";

// Set up associations

// User-Role associations (Many-to-Many)
User.belongsToMany(Role, {
  through: UserRole,
  foreignKey: "userId",
  as: "roles",
});
Role.belongsToMany(User, {
  through: UserRole,
  foreignKey: "roleId",
  as: "users",
});

// Role-Permission associations (Many-to-Many)
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "roleId",
  as: "permissions",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permissionId",
  as: "roles",
});

// Project-User associations (Many-to-Many)
Project.belongsToMany(User, {
  through: ProjectUser,
  foreignKey: "projectId",
  as: "members",
});
User.belongsToMany(Project, {
  through: ProjectUser,
  foreignKey: "userId",
  as: "projects",
});

ProjectUser.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});
ProjectUser.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project"
});

// Export models
export { User, Role, Permission, UserRole, RolePermission, Log, Project, ProjectUser };
