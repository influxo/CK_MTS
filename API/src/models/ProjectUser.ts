import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";

class ProjectUser extends Model {
  // Define attributes
  public id!: string;
  public projectId!: string;
  public userId!: string;
  
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ProjectUser.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
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
    tableName: "project_users",
    indexes: [
      {
        unique: true,
        fields: ['projectId', 'userId']
      }
    ]
  }
);

export default ProjectUser;
