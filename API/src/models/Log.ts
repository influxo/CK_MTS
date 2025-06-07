import { Model, DataTypes } from 'sequelize';
import sequelize from '../db/connection';
import { v4 as uuidv4 } from 'uuid';

class Log extends Model {
  public id!: string;
  public timestamp!: Date;
  public method!: string;
  public url!: string;
  public status!: number;
  public responseTime!: number;
  public ip!: string;
  public userAgent!: string;
  public userId!: string;
}

Log.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    timestamp: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    method: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    responseTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Response time in milliseconds',
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'logs',
    timestamps: false, // We already have timestamp field
  }
);

export default Log;
