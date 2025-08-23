import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";

/**
 * Links a Service to an entity (project or subproject)
 */
class ServiceAssignment extends Model {
  public id!: string;
  public serviceId!: string;
  public entityId!: string;
  public entityType!: 'project' | 'subproject';

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ServiceAssignment.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    serviceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'services', key: 'id' },
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [["project", "subproject"]] },
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
    tableName: 'service_assignments',
    indexes: [
      { unique: true, fields: ['serviceId', 'entityId', 'entityType'] },
      { fields: ['entityId', 'entityType'] },
    ],
  }
);

export default ServiceAssignment;
