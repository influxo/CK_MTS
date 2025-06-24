import User from "./User";
import Role from "./Role";
import Permission from "./Permission";
import UserRole from "./UserRole";
import RolePermission from "./RolePermission";
import Log from "./Log";
import Project from "./Project";
import ProjectUser from "./ProjectUser";
import Subproject from "./Subproject";
import SubprojectUser from "./SubprojectUser";
import Activity from "./Activity";
import ActivityUser from "./ActivityUser";

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

// Project-Subproject associations (One-to-Many)
Project.hasMany(Subproject, {
  foreignKey: "projectId",
  as: "subprojects"
});
Subproject.belongsTo(Project, {
  foreignKey: "projectId",
  as: "project"
});

// Subproject-User associations (Many-to-Many)
Subproject.belongsToMany(User, {
  through: SubprojectUser,
  foreignKey: "subprojectId",
  as: "members"
});
User.belongsToMany(Subproject, {
  through: SubprojectUser,
  foreignKey: "userId",
  as: "subprojects"
});

SubprojectUser.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});
SubprojectUser.belongsTo(Subproject, {
  foreignKey: "subprojectId",
  as: "subproject"
});

// Subproject-Activity associations (One-to-Many)
Subproject.hasMany(Activity, {
  foreignKey: "subprojectId",
  as: "activities"
});
Activity.belongsTo(Subproject, {
  foreignKey: "subprojectId",
  as: "subproject"
});

// Activity-User associations (Many-to-Many)
Activity.belongsToMany(User, {
  through: ActivityUser,
  foreignKey: "activityId",
  as: "members"
});
User.belongsToMany(Activity, {
  through: ActivityUser,
  foreignKey: "userId",
  as: "activities"
});

ActivityUser.belongsTo(User, {
  foreignKey: "userId",
  as: "user"
});
ActivityUser.belongsTo(Activity, {
  foreignKey: "activityId",
  as: "activity"
});

// Export models
export { 
  User, 
  Role, 
  Permission, 
  UserRole, 
  RolePermission, 
  Log, 
  Project, 
  ProjectUser, 
  Subproject, 
  SubprojectUser,
  Activity,
  ActivityUser
};
