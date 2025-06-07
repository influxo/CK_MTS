import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

class Permission extends Model {
  public id!: string;
  public name!: string;
  public description!: string;
  public resource!: string;
  public action!: string;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Permission.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    resource: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'The resource this permission applies to (e.g., "users", "programs")',
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: 'The action allowed on the resource (e.g., "create", "read", "update", "delete")',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'permissions',
  }
);

export default Permission;
