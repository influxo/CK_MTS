import sequelize from './connection';
import { User, Role, Permission, UserRole, RolePermission, Log, Project, ProjectUser, Subproject, SubprojectUser, Activity, ActivityUser, FormTemplate, FormResponse, AuditLog } from '../models';

const initDatabase = async () => {
  try {
    // Test the connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Sync all models with the database
    // Note: Using { force: true } will drop tables if they exist
    // In production, you should use { alter: true } or migrations
    await sequelize.sync({ alter: true });
    console.log('All models were synchronized successfully.');
    
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
};

export default initDatabase;
