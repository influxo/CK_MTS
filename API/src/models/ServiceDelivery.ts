import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";

class ServiceDelivery extends Model {
  public id!: string;
  public serviceId!: string;
  public beneficiaryId!: string;
  public entityId!: string;
  public entityType!: 'project' | 'subproject' | 'activity';
  public formResponseId?: string | null;
  public staffUserId?: string | null;
  public deliveredAt!: Date;
  public notes?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ServiceDelivery.init(
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
    beneficiaryId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'beneficiaries', key: 'id' },
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isIn: [["project", "subproject", "activity"]] },
    },
    formResponseId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'form_responses', key: 'id' },
    },
    staffUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: 'service_deliveries',
    indexes: [
      { fields: ['beneficiaryId'] },
      { fields: ['serviceId'] },
      { fields: ['entityId', 'entityType'] },
      { fields: ['deliveredAt'] },
    ],
  }
);

export default ServiceDelivery;
