import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

class BeneficiaryMatchKey extends Model {
  public id!: string;
  public beneficiaryId!: string;
  public keyType!: string; // e.g., 'nationalId', 'phone+dob', 'name+dob'
  public keyHash!: string; // HMAC-SHA256 hex digest

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BeneficiaryMatchKey.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    beneficiaryId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    keyType: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    keyHash: {
      type: DataTypes.STRING,
      allowNull: false,
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
    tableName: 'beneficiary_match_keys',
    indexes: [
      { unique: true, fields: ['keyType', 'keyHash'] },
      { fields: ['beneficiaryId'] }
    ]
  }
);

export default BeneficiaryMatchKey;
