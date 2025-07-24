import { Request, Response } from "express";
import { FormTemplate, Project, AuditLog } from "../../models";
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../utils/logger";
import { Op } from "sequelize";
import sequelize from "../../db/connection";

// Create a logger instance for this module
const logger = createLogger('forms-templates-controller');

/**
 * Create a new form template
 */
export const createFormTemplate = async (req: Request, res: Response) => {
  logger.info('Creating new form template', { templateName: req.body.name });
  
  try {
    const { name, programId, schema } = req.body;

    // Validate required fields
    if (!name || !programId || !schema) {
      logger.warn('Missing required fields for form template');
      return res.status(400).json({
        success: false,
        message: "Name, programId, and schema are required",
      });
    }

    // Validate schema structure
    if (!schema.fields || !Array.isArray(schema.fields)) {
      logger.warn('Invalid schema structure');
      return res.status(400).json({
        success: false,
        message: "Schema must have a fields array",
      });
    }
    
    // Use transaction for atomicity
    const result = await sequelize.transaction(async (transaction) => {
      // Check if program exists
      const program = await Project.findByPk(programId, { transaction });
      if (!program) {
        logger.warn('Program not found', { programId: programId });
        return { success: false, status: 404, message: "Program not found" };
      }

      // Verify user has access to this program if req.user.allowedProgramIds exists
      if (req.user && req.user.allowedProgramIds && 
          !req.user.allowedProgramIds.includes(programId)) {
        logger.warn('User does not have access to program', { 
          userId: req.user.id, 
          programId: programId
        });
        return { success: false, status: 403, message: "You do not have access to this program" };
      }
      
      // Check if a form with the same name already exists for this program
      const existingTemplate = await FormTemplate.findOne({
        where: {
          programId,
          name
        },
        transaction
      });
      
      if (existingTemplate) {
        logger.warn('Form template with this name already exists for this program', { 
          name, programId: programId 
        });
        return { 
          success: false, 
          status: 409, 
          message: "A form template with this name already exists for this program" 
        };
      }

      // Create the form template
      logger.info('Creating form template', { name, programId: programId });
      const formTemplate = await FormTemplate.create({
        id: uuidv4(),
        name,
        programId,
        schema,
        version: 1, // Initial version
      }, { transaction });
      
      // Create audit log entry
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'FORM_TEMPLATE_CREATE',
        description: `Created form template '${name}'`,
        details: JSON.stringify({
          templateId: formTemplate.id,
          programId: programId,
          version: 1
        }),
        timestamp: new Date()
      }, { transaction });

      // Log the creation for application logging
      logger.info('Form template created', { 
        templateId: formTemplate.id, 
        name, 
        programId: programId
      });

      return { 
        success: true, 
        status: 201, 
        message: "Form template created successfully",
        data: formTemplate 
      };
    });
    
    // Handle transaction result
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(result.status).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error: any) {
    logger.error('Error creating form template', error);
    return res.status(500).json({
      success: false,
      message: "Error creating form template",
      error: error.message,
    });
  }
};

/**
 * Update an existing form template
 */
export const updateFormTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Updating form template', { templateId: id });
  
  try {
    const { name, schema } = req.body;
    
    // Use transaction for atomicity
    const result = await sequelize.transaction(async (transaction) => {
      // Find the template
      const template = await FormTemplate.findByPk(id, { transaction });
      if (!template) {
        logger.warn('Form template not found', { templateId: id });
        return { success: false, status: 404, message: "Form template not found" };
      }

      // Verify user has access to this template's program if req.user.allowedProgramIds exists
      if (req.user && req.user.allowedProgramIds && 
          !req.user.allowedProgramIds.includes(template.programId)) {
        logger.warn('User does not have access to program', { 
          userId: req.user.id, 
          programId: template.programId
        });
        return { success: false, status: 403, message: "You do not have access to this program" };
      }
      
      // Check if a form with the new name already exists for this program
      if (name && name !== template.name) {
        const existingTemplate = await FormTemplate.findOne({
          where: {
            programId: template.programId,
            name,
            id: { [Op.ne]: id } // Exclude current template
          },
          transaction
        });
        
        if (existingTemplate) {
          logger.warn('Another form template with this name already exists', { name });
          return { 
            success: false, 
            status: 409, 
            message: "Another form template with this name already exists for this program" 
          };
        }
      }

      // Check if schema is being updated
      let newVersion = template.version;
      const isSchemaChanged = schema && JSON.stringify(schema) !== JSON.stringify(template.schema);
      if (isSchemaChanged) {
        newVersion += 1; // Increment version if schema is changing
      }

      // Update the template
      logger.info('Updating form template', { templateId: id });
      const [updated] = await FormTemplate.update(
        {
          name: name || template.name,
          schema: schema || template.schema,
          version: newVersion,
        },
        {
          where: { id },
          transaction
        }
      );

      if (!updated) {
        logger.warn('Form template update failed', { templateId: id });
        return { success: false, status: 500, message: "Failed to update form template" };
      }

      // Get updated template
      const updatedTemplate = await FormTemplate.findByPk(id, { transaction });
      
      // Create audit log entry
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'FORM_TEMPLATE_UPDATE',
        description: `Updated form template '${updatedTemplate!.name}'`,
        details: JSON.stringify({
          templateId: id,
          programId: template.programId,
          version: newVersion,
          schemaChanged: isSchemaChanged
        }),
        timestamp: new Date()
      }, { transaction });

      // Log the update for application logging
      logger.info('Form template updated', { 
        templateId: id, 
        newVersion, 
        userId: req.user.id 
      });

      return { 
        success: true, 
        status: 200, 
        message: "Form template updated successfully",
        data: updatedTemplate
      };
    });
    
    // Handle transaction result
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(result.status).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    logger.error(`Error updating form template with ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get all form templates for a program
 */
export const getFormTemplatesByProgram = async (req: Request, res: Response) => {
  const { programId } = req.query;
  
  if (!programId) {
    return res.status(400).json({
      success: false,
      message: "Program ID is required",
    });
  }
  
  // Parse pagination parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  logger.info('Getting form templates by program', { programId, page, limit });

  if (!programId) {
    logger.warn('Missing program ID parameter');
    return res.status(400).json({
      success: false,
      message: "Program ID parameter is required",
    });
  }

  // Verify user has access to this program if req.user.allowedProgramIds exists
  if (req.user && req.user.allowedProgramIds && 
      !req.user.allowedProgramIds.includes(programId as string)) {
    logger.warn('User does not have access to program', { 
      userId: req.user.id, 
      programId 
    });
    return res.status(403).json({
      success: false,
      message: "You do not have access to this program",
    });
  }

  // Get templates for this program with pagination
  const [templates, totalCount] = await Promise.all([
    FormTemplate.findAll({
      where: {
        programId: programId,
      },
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    }),
    FormTemplate.count({
      where: {
        programId: programId
      }
    })
  ]);
  
  // Calculate pagination metadata
  const totalPages = Math.ceil(totalCount / limit);

  logger.info('Successfully retrieved form templates', { 
    programId, 
    count: templates.length,
    page,
    totalPages
  });
  
  return res.status(200).json({
    success: true,
    data: templates,
    meta: {
      page,
      limit,
      totalPages,
      totalItems: totalCount
    }
  });
};

/**
 * Get form template by ID
 */
export const getFormTemplateById = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Getting form template by ID', { templateId: id });
  
  try {
    const template = await FormTemplate.findByPk(id);

    if (!template) {
      logger.warn('Form template not found', { templateId: id });
      return res.status(404).json({
        success: false,
        message: "Form template not found",
      });
    }

    // Verify user has access to this template's program if req.user.allowedProgramIds exists
    if (req.user && req.user.allowedProgramIds && 
        !req.user.allowedProgramIds.includes(template.programId)) {
      logger.warn('User does not have access to program', { 
        userId: req.user.id, 
        programId: template.programId
      });
      return res.status(403).json({
        success: false,
        message: "You do not have access to this program",
      });
    }

    logger.info('Successfully retrieved form template', { templateId: id });
    return res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error(`Error fetching form template with ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Delete a form template (soft delete)
export const deleteFormTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Deleting form template', { templateId: id });
  
  try {
    // Use transaction for atomicity
    const result = await sequelize.transaction(async (transaction) => {
      // Find the template
      const template = await FormTemplate.findByPk(id, { transaction });
      if (!template) {
        logger.warn('Form template not found', { templateId: id });
        return { success: false, status: 404, message: "Form template not found" };
      }

      // Verify user has access to this template's program if req.user.allowedProgramIds exists
      if (req.user && req.user.allowedProgramIds && 
          !req.user.allowedProgramIds.includes(template.programId)) {
        logger.warn('User does not have access to program', { 
          userId: req.user.id, 
          programId: template.programId
        });
        return { success: false, status: 403, message: "You do not have access to this program" };
      }

      // Soft delete the template (sets deletedAt)
      await template.destroy({ transaction });
      
      // Create audit log entry
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'FORM_TEMPLATE_DELETE',
        description: `Deleted form template '${template.name}'`,
        details: JSON.stringify({
          templateId: id,
          programId: template.programId,
          version: template.version
        }),
        timestamp: new Date()
      }, { transaction });
      
      logger.info('Form template deleted', { templateId: id, userId: req.user.id });
      
      return { 
        success: true, 
        status: 200, 
        message: "Form template deleted successfully" 
      };
    });
    
    // Handle transaction result
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(result.status).json({
      success: true,
      message: result.message
    });
  } catch (error: any) {
    logger.error('Error deleting form template', error);
    return res.status(500).json({
      success: false,
      message: `Error deleting form template: ${error.message}`,
    });
  }
};

export default {
  createFormTemplate,
  updateFormTemplate,
  getFormTemplateById,
  getFormTemplatesByProgram,
  deleteFormTemplate
};
