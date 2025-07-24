import { Request, Response } from "express";
import { FormTemplate, FormResponse, User, AuditLog } from "../../models";
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../utils/logger";
import { Op } from "sequelize";
import sequelize from "../../db/connection";
import validateFormResponse from "../../services/forms/validateFormResponse";

// Create a logger instance for this module
const logger = createLogger('forms-responses-controller');

/**
 * Submit a form response
 */
export const submitFormResponse = async (req: Request, res: Response) => {
  const { id } = req.params; // form template id
  logger.info('Submitting form response', { templateId: id });
  
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

      const data = req.body.data || req.body;
      const { latitude, longitude } = req.body;

      // Use AJV for validation
      const validationResult = await validateFormResponse(id, data);
      if (!validationResult.valid) {
        logger.warn('Form data validation errors', { errors: validationResult.errors });
        return { 
          success: false, 
          status: 400, 
          message: "Form validation errors",
          errors: validationResult.errors
        };
      }

      // Create the form response
      logger.info('Creating form response', { templateId: id, userId: req.user.id });
      const formResponse = await FormResponse.create({
        id: uuidv4(),
        formTemplateId: id,
        programId: template.programId,
        submittedBy: req.user.id,
        data: validationResult.data, // Use sanitized data
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        submittedAt: new Date(),
      }, { transaction });

      // Create audit log entry
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'FORM_RESPONSE_SUBMIT',
        description: `Submitted response to form '${template.name}'`,
        details: JSON.stringify({
          templateId: id,
          responseId: formResponse.id,
          programId: template.programId,
          version: template.version
        }),
        timestamp: new Date()
      }, { transaction });

      // Log the action for application logging
      logger.info('Form response submitted', { 
        responseId: formResponse.id, 
        templateId: id, 
        userId: req.user.id,
        programId: template.programId
      });

      return { 
        success: true, 
        status: 201, 
        message: "Form response submitted successfully",
        data: formResponse 
      };
    });

    // Handle the transaction result
    if (!result.success) {
      return res.status(result.status).json({
        success: false,
        message: result.message,
        errors: result.errors
      });
    }

    return res.status(result.status).json({
      success: true,
      message: result.message,
      data: result.data,
    });
  } catch (error: any) {
    logger.error('Error submitting form response', error);
    return res.status(500).json({
      success: false,
      message: "Error submitting form response",
      error: error.message,
    });
  }
};

/**
 * Get all responses for a form template
 */
export const getFormResponses = async (req: Request, res: Response) => {
  const { id } = req.params; // form template id
  logger.info('Getting form responses', { templateId: id });
  
  try {
    // Parse pagination and filter parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : null;
    
    // Find the template
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
    
    // Build where clause based on filters
    const whereClause: any = { formTemplateId: id };
    if (fromDate && toDate) {
      whereClause.submittedAt = {
        [Op.between]: [fromDate, toDate]
      };
    } else if (fromDate) {
      whereClause.submittedAt = {
        [Op.gte]: fromDate
      };
    } else if (toDate) {
      whereClause.submittedAt = {
        [Op.lte]: toDate
      };
    }
    
    // Get paginated responses and total count
    const [responses, totalCount] = await Promise.all([
      FormResponse.findAll({
        where: whereClause,
        limit,
        offset,
        order: [['submittedAt', 'DESC']],
        include: [
          {
            model: User,
            as: 'submitter',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ]
      }),
      FormResponse.count({
        where: whereClause
      })
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);

    logger.info('Successfully retrieved form responses', { 
      templateId: id, 
      count: responses.length,
      page,
      totalPages
    });
    
    return res.status(200).json({
      success: true,
      data: responses,
      meta: {
        page,
        limit,
        totalPages,
        totalItems: totalCount
      }
    });
  } catch (error) {
    logger.error(`Error fetching form responses for template ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Removed manual validation in favor of AJV validation service

export default {
  submitFormResponse,
  getFormResponses
};
