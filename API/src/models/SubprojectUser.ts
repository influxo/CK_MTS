import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";

class SubprojectUser extends Model {
  // Define attributes
  public id!: string;
  public userId!: string;
  public subprojectId!: string;
  public role?: string; // Optional role within the subproject

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

SubprojectUser.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    subprojectId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "subprojects",
        key: "id",
      },
    }
  },
  {
    sequelize,
    modelName: "subprojectUser",
    tableName: "subproject_users",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["userId", "subprojectId"],
      },
    ],
  }
);

export default SubprojectUser;
