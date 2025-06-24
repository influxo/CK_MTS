import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";

class ActivityUser extends Model {
  // Define attributes
  public id!: string;
  public userId!: string;
  public activityId!: string;
  public role?: string; // Optional role within the activity

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ActivityUser.init(
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
    activityId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "activities",
        key: "id",
      },
    },
    role: {
      type: DataTypes.STRING,
      allowNull: true,
    }
  },
  {
    sequelize,
    modelName: "activityUser",
    tableName: "activity_users",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["userId", "activityId"],
      },
    ],
  }
);

export default ActivityUser;
