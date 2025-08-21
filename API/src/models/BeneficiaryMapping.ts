import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

/**
 * BeneficiaryMapping stores per-formTemplate mapping configuration
 * to extract Beneficiary fields and which match strategies to use.
 * Example mapping:
 * {
 *   fields: {
 *     firstName: 'first_name',
 *     lastName: 'last_name',
 *     dob: 'date_of_birth',
 *     nationalId: 'national_id',
 *     phone: 'phone',
 *     email: 'email',
 *     address: 'address'
 *   },
 *   strategies: ['nationalId', 'phone+dob', 'name+dob']
 * }
 */
class BeneficiaryMapping extends Model {
  public id!: string;
  public formTemplateId!: string;
  public mapping!: any; // JSONB config

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

BeneficiaryMapping.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    formTemplateId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'form_templates',
        key: 'id',
      },
    },
    mapping: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        hasFields(val: any) {
          if (!val || typeof val !== 'object' || !val.fields) {
            throw new Error('Mapping must contain a fields object');
          }
        }
      }
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
    tableName: 'beneficiary_mappings',
  }
);

export default BeneficiaryMapping;
