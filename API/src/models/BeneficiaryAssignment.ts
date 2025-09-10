import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * Links a Beneficiary to an entity (project or subproject)
 */
class BeneficiaryAssignment extends Model {
  public id!: string;
  public beneficiaryId!: string;
  public entityId!: string;
  public entityType!: 'project' | 'subproject';

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BeneficiaryAssignment.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
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
      validate: { isIn: [["project", "subproject"]] },
    },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'beneficiary_assignments',
    indexes: [
      { unique: true, fields: ['beneficiaryId', 'entityId', 'entityType'] },
      { fields: ['entityId', 'entityType'] },
      { fields: ['beneficiaryId'] },
    ],
  }
);

export default BeneficiaryAssignment;
