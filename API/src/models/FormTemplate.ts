import { Model, DataTypes } from "sequelize";
import sequelize from "../db/connection";
import { v4 as uuidv4 } from "uuid";
import { JSONSchema7 } from "json-schema";

class FormTemplate extends Model {
  // Define attributes
  public id!: string;
  public name!: string;
  public programId!: string; // foreign key to programs or sub-projects
  public schema!: any; // JSONB field storing form structure
  public version!: number;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt!: Date | null;
  
  /**
   * Generates a JSON Schema (draft-07) from the form template schema
   * @returns JSONSchema7 object
   */
  public static generateJsonSchema(templateSchema: any): JSONSchema7 {
    if (!templateSchema || !templateSchema.fields || !Array.isArray(templateSchema.fields)) {
      throw new Error("Invalid form schema format");
    }
    
    const properties: Record<string, any> = {};
    const required: string[] = [];
    
    for (const field of templateSchema.fields) {
      const { name, type, required: isRequired } = field;
      
      if (isRequired) {
        required.push(name);
      }
      
      let propSchema: Record<string, any> = {};
      
      switch (type) {
        case 'Text':
          propSchema = { type: 'string' };
          break;
        case 'Number':
          propSchema = { type: 'number' };
          break;
        case 'Date':
          propSchema = { type: 'string', format: 'date' };
          break;
        case 'Checkbox':
          propSchema = { type: 'boolean' };
          break;
        case 'Dropdown':
          propSchema = {
            type: 'string',
            enum: field.options || []
          };
          break;
        default:
          propSchema = { type: 'string' };
      }
      
      properties[name] = propSchema;
    }
    
    const schema: JSONSchema7 = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
      additionalProperties: false
    };
    
    return schema;
  }
}

FormTemplate.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    programId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    schema: {
      type: DataTypes.JSONB,
      allowNull: false,
      validate: {
        isValidSchema(value: any) {
          if (!value || !value.fields || !Array.isArray(value.fields)) {
            throw new Error("Schema must include a 'fields' array");
          }

          // Validate each field has required properties
          for (const field of value.fields) {
            if (!field.name || !field.label || !field.type) {
              throw new Error("Each field must have name, label, and type properties");
            }

            // Validate field types
            const validTypes = ["Text", "Number", "Date", "Dropdown", "Checkbox"];
            if (!validTypes.includes(field.type)) {
              throw new Error(`Field type must be one of: ${validTypes.join(", ")}`);
            }

            // Validate dropdown fields have options
            if (field.type === "Dropdown" && (!field.options || !Array.isArray(field.options) || field.options.length === 0)) {
              throw new Error("Dropdown fields must include an 'options' array");
            }
          }
        }
      }
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
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
    tableName: "form_templates",
    paranoid: true,
  }
);

export default FormTemplate;
