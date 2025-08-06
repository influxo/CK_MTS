import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";
import FormTemplate from "./FormTemplate";

/**
 * Junction table to manage many-to-many relationships between form templates and entities
 * (projects, subprojects, activities)
 */
class FormEntityAssociation extends Model {
  // Define attributes
  public id!: string;
  public formTemplateId!: string; // foreign key to form_templates
  public entityId!: string; // ID of the entity (project, subproject, or activity)
  public entityType!: string; // 'project', 'subproject', or 'activity'

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

FormEntityAssociation.init(
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
    tableName: "form_entity_associations",
    indexes: [
      {
        unique: true,
        fields: ['formTemplateId', 'entityId', 'entityType']
      }
    ]
  }
);

export default FormEntityAssociation;
