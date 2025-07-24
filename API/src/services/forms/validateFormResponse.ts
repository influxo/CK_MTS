import Ajv, { ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { FormTemplate } from '../../models';
import { createLogger } from '../../utils/logger';

const logger = createLogger('form-validation-service');

// Initialize Ajv
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Schema cache to avoid recompilation
const schemaCache = new Map<string, any>();

/**
 * Validates form data against a template's schema
 * @param templateId The ID of the form template
 * @param data The form response data to validate
 * @returns Object containing validation result and any errors
 */
export const validateFormResponse = async (templateId: string, data: any) => {
  try {
    // Try to get the validator from cache
    let validator: any = schemaCache.get(templateId);
    
    if (!validator) {
      // If not in cache, retrieve the template and compile schema
      const template = await FormTemplate.findByPk(templateId);
      
      if (!template) {
        logger.error(`Template not found for validation: ${templateId}`);
        return { 
          valid: false, 
          errors: ['Form template not found'] 
        };
      }
      
      // Generate JSON Schema from template schema
      const jsonSchema = FormTemplate.generateJsonSchema(template.schema);
      
      // Compile the schema
      validator = ajv.compile(jsonSchema);
      
      // Cache the validator
      schemaCache.set(templateId, validator);
      
      logger.info(`Compiled and cached schema for template: ${templateId}`);
    }
    
    // Validate the data
    const valid = validator(data);
    
    if (!valid) {
      // Format error messages
      const errors = (validator.errors || []).map((error: ErrorObject) => {
        let message = error.message || 'Invalid data';
        
        // Add path information if available
        if (error.instancePath) {
          const fieldName = error.instancePath.replace(/^\//, '');
          message = `Field '${fieldName}': ${message}`;
        }
        
        return message;
      });
      
      logger.warn(`Validation failed for template ${templateId}`, { errors });
      
      return {
        valid: false,
        errors
      };
    }
    
    // Sanitize input to prevent XSS
    const sanitizedData = sanitizeFormData(data);
    
    return {
      valid: true,
      data: sanitizedData
    };
    
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Error validating form data: ${err.message}`);
    return {
      valid: false,
      errors: [err.message || 'Validation error']
    };
  }
};

/**
 * Sanitizes form data to prevent XSS attacks
 * @param data The form data to sanitize
 * @returns Sanitized form data
 */
const sanitizeFormData = (data: any): any => {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  // If it's an array, sanitize each element
  if (Array.isArray(data)) {
    return data.map(item => sanitizeFormData(item));
  }
  
  // Process object properties
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      // Sanitize string values
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      // Recurse into nested objects
      result[key] = sanitizeFormData(value);
    } else {
      // Other types (number, boolean, etc.) can be copied as-is
      result[key] = value;
    }
  }
  
  return result;
};

/**
 * Sanitizes a string to prevent XSS attacks
 * @param input The string to sanitize
 * @returns Sanitized string
 */
const sanitizeString = (input: string): string => {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, 'removed:')
    .replace(/on\w+=/gi, 'data-removed=');
};

export default validateFormResponse;
