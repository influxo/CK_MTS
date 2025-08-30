import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * Beneficiary model storing encrypted PII fields per AES-256-GCM.
 */
class Beneficiary extends Model {
  public id!: string;
  public pseudonym!: string;
  public status!: 'active' | 'inactive';

  // PII fields
  public firstNameEnc?: any | null;     
  public lastNameEnc?: any | null;     
  public dobEnc?: any | null;          
  public genderEnc?: any | null;       
  public addressEnc?: any | null;      
  public municipalityEnc?: any | null; 
  public nationalityEnc?: any | null;  // <-- NEW
  public nationalIdEnc?: any | null;   
  public phoneEnc?: any | null;
  public emailEnc?: any | null;

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
      validate: { isIn: [['active', 'inactive']] },
    },

    firstNameEnc:     { type: DataTypes.JSONB, allowNull: true },
    lastNameEnc:     { type: DataTypes.JSONB, allowNull: true },
    dobEnc:          { type: DataTypes.JSONB, allowNull: true },
    genderEnc:       { type: DataTypes.JSONB, allowNull: true },
    addressEnc:      { type: DataTypes.JSONB, allowNull: true },
    municipalityEnc: { type: DataTypes.JSONB, allowNull: true },
    nationalityEnc:  { type: DataTypes.JSONB, allowNull: true }, // <-- NEW
    nationalIdEnc:   { type: DataTypes.JSONB, allowNull: true },
    phoneEnc:        { type: DataTypes.JSONB, allowNull: true },
    emailEnc:        { type: DataTypes.JSONB, allowNull: true },

    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'beneficiaries',
    indexes: [
      { fields: ['pseudonym'], unique: true },
      { fields: ['status'] },
    ],
  }
);

export default Beneficiary;
