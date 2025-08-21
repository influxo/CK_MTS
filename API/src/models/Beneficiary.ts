import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * Beneficiary model storing encrypted PII fields per AES-256-GCM.
 * PII fields are stored as JSONB objects of shape { alg, iv, tag, data }.
 */
class Beneficiary extends Model {
  public id!: string;
  public pseudonym!: string; // masked identifier
  public status!: 'active' | 'inactive';

  public firstNameEnc?: any | null;
  public lastNameEnc?: any | null;
  public dobEnc?: any | null;
  public nationalIdEnc?: any | null;
  public phoneEnc?: any | null;
  public emailEnc?: any | null;
  public addressEnc?: any | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Beneficiary.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    pseudonym: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'inactive']],
      },
    },
    firstNameEnc: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    lastNameEnc: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    dobEnc: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    nationalIdEnc: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    phoneEnc: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    emailEnc: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    addressEnc: {
      type: DataTypes.JSONB,
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
    tableName: 'beneficiaries',
  }
);

export default Beneficiary;
