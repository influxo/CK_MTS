import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";
import FormTemplate from "./FormTemplate";
import User from "./User";

class FormResponse extends Model {
  // Define attributes
  public id!: string;
  public formTemplateId!: string; // foreign key to form_templates
  public entityId!: string; // ID of the entity this response is associated with
  public entityType!: string; // 'project', 'subproject', or 'activity'
  public submittedBy!: string; // foreign key to users
  public beneficiaryId?: string | null; // optional foreign key to beneficiaries
  public data!: any; // JSONB field storing user responses
  public latitude?: number; // optional GPS latitude coordinate
  public longitude?: number; // optional GPS longitude coordinate
  public submittedAt!: Date;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FormResponse.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    formTemplateId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "form_templates",
        key: "id",
      },
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isIn: [['project', 'subproject', 'activity']]
      },
      defaultValue: 'project', // Default to maintain backward compatibility
    },
    submittedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
    beneficiaryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "beneficiaries",
        key: "id",
      },
    },
    data: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    latitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true,
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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
    tableName: "form_responses",
  }
);

export default FormResponse;
