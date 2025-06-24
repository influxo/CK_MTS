import { Model, DataTypes, HasManyGetAssociationsMixin, HasManyAddAssociationMixin, HasManyRemoveAssociationMixin } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";
import User from "./User";
import Project from "./Project";
import Activity from "./Activity";

class Subproject extends Model {
  // Define attributes
  public id!: string;
  public name!: string;
  public description!: string;
  public category!: string;
  public status!: string; // 'active', 'inactive'
  public projectId!: string; // Foreign key to parent Project

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly members?: User[];
  public getMembers!: HasManyGetAssociationsMixin<User>;
  public addMember!: HasManyAddAssociationMixin<User, string>;
  public removeMember!: HasManyRemoveAssociationMixin<User, string>;
  
  // Activities association
  public readonly activities?: Activity[];
  public getActivities!: HasManyGetAssociationsMixin<Activity>;
  public addActivity!: HasManyAddAssociationMixin<Activity, string>;
  public removeActivity!: HasManyRemoveAssociationMixin<Activity, string>;
}

Subproject.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "active",
      validate: {
        isIn: [["active", "inactive"]],
      },
    },
    projectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "projects",
        key: "id"
      }
    }
  },
  {
    sequelize,
    modelName: "subproject",
    tableName: "subprojects",
    timestamps: true,
  }
);

export default Subproject;
