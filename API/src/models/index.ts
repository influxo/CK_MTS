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
import FormTemplate from "./FormTemplate";
import FormResponse from "./FormResponse";
import AuditLog from "./AuditLog";
import MfaTempToken from "./MfaTempToken";
import FormField from "./FormField";
import Kpi from "./Kpi";
import Beneficiary from "./Beneficiary";
import BeneficiaryMatchKey from "./BeneficiaryMatchKey";
import BeneficiaryMapping from "./BeneficiaryMapping";
import Service from "./Service";
import ServiceAssignment from "./ServiceAssignment";
import ServiceDelivery from "./ServiceDelivery";
import BeneficiaryDetails from "./BeneficiaryDetails";
import BeneficiaryAssignment from "./BeneficiaryAssignment";

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

// Project-FormTemplate associations
Project.hasMany(FormTemplate, {
  foreignKey: "programId",
  as: "formTemplates"
});
FormTemplate.belongsTo(Project, {
  foreignKey: "programId",
  as: "program"
});

// FormTemplate-FormResponse associations
FormTemplate.hasMany(FormResponse, {
  foreignKey: "formTemplateId",
  as: "responses"
});
FormResponse.belongsTo(FormTemplate, {
  foreignKey: "formTemplateId",
  as: "template"
});

// FormResponse-User associations
User.hasMany(FormResponse, {
  foreignKey: "submittedBy",
  as: "formResponses"
});
FormResponse.belongsTo(User, {
  foreignKey: "submittedBy",
  as: "submitter"
});

// FormResponse-Beneficiary associations
Beneficiary.hasMany(FormResponse, {
  foreignKey: "beneficiaryId",
  as: "responses"
});
FormResponse.belongsTo(Beneficiary, {
  foreignKey: "beneficiaryId",
  as: "beneficiary"
});

// FormField-Kpi associations
FormField.hasMany(Kpi, {
  foreignKey: "fieldId",
  as: "kpis"
});
Kpi.belongsTo(FormField, {
  foreignKey: "fieldId",
  as: "field"
});

// Beneficiary-MatchKey associations
Beneficiary.hasMany(BeneficiaryMatchKey, {
  foreignKey: 'beneficiaryId',
  as: 'matchKeys'
});
BeneficiaryMatchKey.belongsTo(Beneficiary, {
  foreignKey: 'beneficiaryId',
  as: 'beneficiary'
});

// Beneficiary-Details association (1:1)
Beneficiary.hasOne(BeneficiaryDetails, {
  foreignKey: 'beneficiaryId',
  as: 'details'
});
BeneficiaryDetails.belongsTo(Beneficiary, {
  foreignKey: 'beneficiaryId',
  as: 'beneficiary'
});

// Beneficiary-Assignment associations (Beneficiary <-> Project/Subproject via polymorphic join)
Beneficiary.hasMany(BeneficiaryAssignment, {
  foreignKey: 'beneficiaryId',
  as: 'assignments'
});
BeneficiaryAssignment.belongsTo(Beneficiary, {
  foreignKey: 'beneficiaryId',
  as: 'beneficiary'
});

// Service associations
Service.hasMany(ServiceAssignment, {
  foreignKey: 'serviceId',
  as: 'assignments'
});
ServiceAssignment.belongsTo(Service, {
  foreignKey: 'serviceId',
  as: 'service'
});

Service.hasMany(ServiceDelivery, {
  foreignKey: 'serviceId',
  as: 'deliveries'
});
ServiceDelivery.belongsTo(Service, {
  foreignKey: 'serviceId',
  as: 'service'
});

Beneficiary.hasMany(ServiceDelivery, {
  foreignKey: 'beneficiaryId',
  as: 'serviceDeliveries'
});
ServiceDelivery.belongsTo(Beneficiary, {
  foreignKey: 'beneficiaryId',
  as: 'beneficiary'
});

User.hasMany(ServiceDelivery, {
  foreignKey: 'staffUserId',
  as: 'serviceDeliveries'
});
ServiceDelivery.belongsTo(User, {
  foreignKey: 'staffUserId',
  as: 'staff'
});

FormResponse.hasMany(ServiceDelivery, {
  foreignKey: 'formResponseId',
  as: 'serviceDeliveries'
});
ServiceDelivery.belongsTo(FormResponse, {
  foreignKey: 'formResponseId',
  as: 'formResponse'
});

// FormTemplate-BeneficiaryMapping associations
FormTemplate.hasOne(BeneficiaryMapping, {
  foreignKey: 'formTemplateId',
  as: 'beneficiaryMapping'
});
BeneficiaryMapping.belongsTo(FormTemplate, {
  foreignKey: 'formTemplateId',
  as: 'formTemplate'
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
  ActivityUser,
  FormTemplate,
  FormResponse,
  AuditLog,
  MfaTempToken,
  FormField,
  Kpi,
  Beneficiary,
  BeneficiaryMatchKey,
  BeneficiaryMapping,
  Service,
  ServiceAssignment,
  ServiceDelivery,
  BeneficiaryDetails,
  BeneficiaryAssignment
};
