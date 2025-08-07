import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";

class Kpi extends Model {
  public id!: string;
  public name!: string;
  public description?: string;
  public calculationType!: string;
  public fieldId!: string;
  public aggregationType!: string;
  public filterCriteria?: object;
  public isActive!: boolean;
  public createdAt!: Date;
  public updatedAt!: Date;
}

Kpi.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    calculationType: {
      type: DataTypes.ENUM('COUNT', 'SUM', 'AVERAGE', 'MIN', 'MAX', 'PERCENTAGE', 'CUSTOM'),
      allowNull: false,
    },
    fieldId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'form_fields',
        key: 'id',
      },
    },
    aggregationType: {
      type: DataTypes.ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ALL_TIME'),
      allowNull: false,
      defaultValue: 'ALL_TIME',
    },
    filterCriteria: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: "JSON criteria for filtering responses",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "kpis",
    timestamps: true,
  }
);

export default Kpi;
