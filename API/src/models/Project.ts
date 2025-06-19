import { Model, DataTypes, HasManyGetAssociationsMixin, HasManyAddAssociationMixin, HasManyRemoveAssociationMixin } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";
import User from "./User";

class Project extends Model {
  // Define attributes
  public id!: string;
  public name!: string;
  public description!: string;
  public category!: string;
  public status!: string; // 'active', 'inactive'

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public readonly members?: User[];
  public getMembers!: HasManyGetAssociationsMixin<User>;
  public addMember!: HasManyAddAssociationMixin<User, string>;
  public removeMember!: HasManyRemoveAssociationMixin<User, string>;
}

Project.init(
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
      type: DataTypes.STRING,
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
    tableName: "projects",
  }
);

export default Project;
