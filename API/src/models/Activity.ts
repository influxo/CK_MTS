import { Model, DataTypes, HasManyGetAssociationsMixin, HasManyAddAssociationMixin, HasManyRemoveAssociationMixin } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";
import User from "./User";
import Subproject from "./Subproject";

class Activity extends Model {
  // Define attributes
  public id!: string;
  public name!: string;
  public description!: string;
  public category!: string;
  public frequency!: string; // Based on the image: 'daily', 'weekly', 'monthly', etc.
  public reportingFields!: string; // JSON string to store the reporting fields from the image
  public subprojectId!: string; // Foreign key to parent Subproject

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly members?: User[];
  public getMembers!: HasManyGetAssociationsMixin<User>;
  public addMember!: HasManyAddAssociationMixin<User, string>;
  public removeMember!: HasManyRemoveAssociationMixin<User, string>;
}

Activity.init(
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
    frequency: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    reportingFields: {
      type: DataTypes.TEXT, // Store as JSON string
      allowNull: true,
      get() {
        const rawValue = this.getDataValue('reportingFields');
        return rawValue ? JSON.parse(rawValue) : {};
      },
      set(value: any) {
        this.setDataValue('reportingFields', JSON.stringify(value));
      }
    },
    subprojectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "subprojects",
        key: "id"
      }
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "active",
      validate: {
        isIn: [["active", "inactive"]],
      },
    }
  },
  {
    sequelize,
    modelName: "activity",
    tableName: "activities",
    timestamps: true,
  }
);

export default Activity;
