import { Request, Response } from "express";
import { FormTemplate, FormResponse, User, AuditLog, Beneficiary, BeneficiaryMapping } from "../../models";
import FormEntityAssociation from "../../models/FormEntityAssociation";
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../utils/logger";
import { Op } from "sequelize";
import sequelize from "../../db/connection";
import validateFormResponse from "../../services/forms/validateFormResponse";
import beneficiariesService from "../../services/beneficiaries/beneficiariesService";

// Create a logger instance for this module
const logger = createLogger('forms-responses-controller');

// Helper to remove a value at a dot-separated path from an object
const deleteByPath = (obj: any, path?: string) => {
  if (!obj || !path) return;
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (cur == null || typeof cur !== 'object') return;
    cur = cur[p];
  }
  if (cur && typeof cur === 'object') {
    delete cur[parts[parts.length - 1]];
  }
};

/**
 * Submit a form response
 */
export const submitFormResponse = async (req: Request, res: Response) => {
  const { id } = req.params; // form template id
  logger.info('Submitting form response', { templateId: id });
  
  try {
    // Use transaction for atomicity
    const result = await sequelize.transaction(async (transaction) => {
      // Find the template with its entity associations
      const template = await FormTemplate.findByPk(id, {
        include: [{
          model: FormEntityAssociation,
          as: 'entityAssociations'
        }],
        transaction
      });
      
      if (!template) {
        logger.warn('Form template not found', { templateId: id });
        return { success: false, status: 404, message: "Form template not found" };
      }
      
      // Get the entity ID and type from the request or use the first associated entity
      const { entityId, entityType } = req.body;
      
      if (!entityId || !entityType) {
        logger.warn('Missing entityId or entityType in request', { templateId: id });
        return { success: false, status: 400, message: "entityId and entityType are required" };
      }
      
      // Check if the entity is associated with this template
      const entityAssociation = template.entityAssociations?.find(ea => 
        ea.entityId === entityId && ea.entityType === entityType
      );
      
      if (!entityAssociation) {
        logger.warn('Entity not associated with this template', { 
          templateId: id, entityId, entityType 
        });
        return { success: false, status: 400, message: "This entity is not associated with this form template" };
      }

      // Verify user has access to this entity if req.user.allowedProgramIds exists
      if (req.user && req.user.allowedProgramIds && 
          !req.user.allowedProgramIds.includes(entityId)) {
        logger.warn('User does not have access to entity', { 
          userId: req.user.id, 
          entityId
        });
        return { success: false, status: 403, message: "You do not have access to this entity" };
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

      // Upsert beneficiary inside the same transaction using mapping for this template
      let beneficiaryId: string | undefined;
      try {
        const upsert = await beneficiariesService.upsertFromFormResponse(
          id,
          validationResult.data,
          { entityId, entityType },
          { transaction, userId: req.user.id }
        );
        beneficiaryId = upsert.beneficiaryId;
      } catch (e) {
        logger.error('Beneficiary upsert failed, proceeding without linkage', { templateId: id, entityId, entityType, error: (e as any)?.message });
      }

      // Redact mapped PII fields from form data before storing
      let sanitizedData: any = JSON.parse(JSON.stringify(validationResult.data));
      try {
        const mapping = await BeneficiaryMapping.findOne({ where: { formTemplateId: id }, transaction });
        const fields = mapping?.mapping?.fields || {};
        for (const path of Object.values(fields)) {
          if (typeof path === 'string' && path.trim()) {
            deleteByPath(sanitizedData, path);
          }
        }
      } catch (_) {
        // If mapping lookup fails, proceed with unredacted data
      }

      // Create the form response
      logger.info('Creating form response', { templateId: id, userId: req.user.id });
      const formResponse = await FormResponse.create({
        id: uuidv4(),
        formTemplateId: id,
        entityId,
        entityType,
        submittedBy: req.user.id,
        beneficiaryId: beneficiaryId ?? null,
        data: sanitizedData,
        latitude,
        longitude,
        submittedAt: new Date()
      }, { transaction });

      // Create audit log entry
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'FORM_RESPONSE_SUBMIT',
        description: `Submitted response to form '${template.name}' for ${entityType} with ID ${entityId}`,
        details: JSON.stringify({
          templateId: id,
          responseId: formResponse.id,
          entityId,
          entityType,
          version: template.version,
          beneficiaryId: beneficiaryId ?? null
        }),
        timestamp: new Date()
      }, { transaction });

      // Log the action for application logging
      logger.info('Form response submitted', { 
        responseId: formResponse.id, 
        templateId: id, 
        userId: req.user.id,
        entityId,
        entityType
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
    
    // Find the template with its entity associations
    const template = await FormTemplate.findByPk(id, {
      include: [{
        model: FormEntityAssociation,
        as: 'entityAssociations'
      }]
    });
    
    if (!template) {
      logger.warn('Form template not found', { templateId: id });
      return res.status(404).json({
        success: false,
        message: "Form template not found",
      });
    }
    
    // Get the entityId and entityType from query parameters
    const { entityId, entityType } = req.query;
    
    // If entityId and entityType are provided, verify they are associated with this template
    if (entityId && entityType) {
      const entityAssociation = template.entityAssociations?.find(ea => 
        ea.entityId === entityId && ea.entityType === entityType
      );
      
      if (!entityAssociation) {
        logger.warn('Entity not associated with this template', { 
          templateId: id, entityId, entityType 
        });
        return res.status(400).json({
          success: false,
          message: "This entity is not associated with this form template"
        });
      }
      
      // Verify user has access to this entity if req.user.allowedProgramIds exists
      if (req.user && req.user.allowedProgramIds && 
          !req.user.allowedProgramIds.includes(entityId as string)) {
        logger.warn('User does not have access to entity', { 
          userId: req.user.id, 
          entityId 
        });
        return res.status(403).json({
          success: false,
          message: "You do not have access to this entity"
        });
      }
    } else {
      // If no specific entity is requested, verify user has access to at least one of the associated entities
      if (req.user && req.user.allowedProgramIds && template.entityAssociations) {
        const hasAccess = template.entityAssociations.some(ea => 
          req.user.allowedProgramIds!.includes(ea.entityId)
        );
        
        if (!hasAccess) {
          logger.warn('User does not have access to any entities associated with this template', { 
            userId: req.user.id, 
            templateId: id 
          });
          return res.status(403).json({
            success: false,
            message: "You do not have access to any entities associated with this form template"
          });
        }
      }
    }
    
    // Build where clause based on filters
    const whereClause: any = { formTemplateId: id };
    
    // Add entity filters if provided
    if (entityId && entityType) {
      whereClause.entityId = entityId;
      whereClause.entityType = entityType;
    }
    
    // Add date filters if provided
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
          },
          {
            model: Beneficiary,
            as: 'beneficiary',
            attributes: ['id', 'pseudonym', 'status']
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
