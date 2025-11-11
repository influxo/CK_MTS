import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

interface MfaTempTokenAttributes {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  attempts: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MfaTempTokenCreationAttributes extends Optional<MfaTempTokenAttributes, 'id' | 'used' | 'attempts' | 'createdAt' | 'updatedAt'> {}

class MfaTempToken extends Model<MfaTempTokenAttributes, MfaTempTokenCreationAttributes> implements MfaTempTokenAttributes {
  public id!: string;
  public userId!: string;
  public token!: string;
  public expiresAt!: Date;
  public used!: boolean;
  public attempts!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

MfaTempToken.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    token: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    used: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'mfa_temp_tokens',
    timestamps: true,
  }
);

export default MfaTempToken;
