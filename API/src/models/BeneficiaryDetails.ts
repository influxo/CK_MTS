import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";

class BeneficiaryDetails extends Model {
  public id!: string;
  public beneficiaryId!: string;
  public details!: any;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BeneficiaryDetails.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    beneficiaryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "beneficiaries",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    details: {
      // Use JSONB for Postgres; Sequelize maps appropriately
      type: (DataTypes as any).JSONB || DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
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
    tableName: "beneficiary_details",
    indexes: [
      { unique: true, fields: ["beneficiaryId"] },
    ],
  }
);

export default BeneficiaryDetails;
