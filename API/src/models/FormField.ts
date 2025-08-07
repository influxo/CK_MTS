import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";

class FormField extends Model {
  public id!: string;
  public name!: string;
  public type!: string;
  public description?: string;
  public isKpiField!: boolean;
  public createdAt!: Date;
  public updatedAt!: Date;
}

FormField.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Field type (text, number, boolean, date, select, etc.)",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    isKpiField: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Whether this field is used for KPI calculations",
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
    tableName: "form_fields",
    timestamps: true,
  }
);

export default FormField;
