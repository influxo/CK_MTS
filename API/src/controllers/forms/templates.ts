import { Request, Response } from "express";
import { FormTemplate, Project, Subproject, Activity, AuditLog } from "../../models";
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../utils/logger";
import { Op } from "sequelize";
import sequelize from "../../db/connection";
import FormEntityAssociation from "../../models/FormEntityAssociation";
import kpiCalculationService from "../../services/forms/kpiCalculationService";

// Create a logger instance for this module
const logger = createLogger('forms-templates-controller');

// Valid entity types for form associations
const validEntityTypes = ['project', 'subproject', 'activity'];

/**
 * Create a new form template
 */
export const createFormTemplate = async (req: Request, res: Response) => {
  logger.info('Creating new form template', { templateName: req.body.name });
  
  try {
    const { name, entities, schema, includeBeneficiaries } = req.body;

    // Validate required fields
    if (!name || !entities || !schema) {
      logger.warn('Missing required fields for form template');
      return res.status(400).json({
        success: false,
        message: "Name, entities, and schema are required",
      });
    }
    
    // Validate entities array
    if (!Array.isArray(entities) || entities.length === 0) {
      logger.warn('Invalid entities value', { entities });
      return res.status(400).json({
        success: false,
        message: "Entities must be a non-empty array",
      });
    }
    
    // Validate each entity in the array
    const validEntityTypes = ['project', 'subproject', 'activity'];
    for (const entity of entities) {
      if (!entity.id || !entity.type) {
        logger.warn('Invalid entity object', { entity });
        return res.status(400).json({
          success: false,
          message: "Each entity must have id and type properties",
        });
      }
      
      if (!validEntityTypes.includes(entity.type)) {
        logger.warn('Invalid entity type', { entityType: entity.type });
        return res.status(400).json({
          success: false,
          message: `Entity type must be one of: ${validEntityTypes.join(', ')}`,
        });
      }
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
      // Check if all entities exist
      // Define interfaces for entity types
      interface EntityWithName {
        id: string;
        name: string;
      }

      // Log all entities being validated
      logger.info('Validating entities', { entities });

      for (const entity of entities) {
        let entityFound = false;
        let entityModel = '';
        let availableEntities: EntityWithName[] = [];
        
        // Normalize entity type to lowercase for consistent comparison
        const entityType = entity.type.toLowerCase();
        
        switch (entityType) {
          case 'subproject':
            entityModel = 'Subproject';
            // Use the Subproject model to validate subprojects
            entityFound = await Subproject.findByPk(entity.id, { transaction }) !== null;
            
            if (!entityFound) {
              // Get list of available subprojects for better error message
              availableEntities = await Subproject.findAll({
                attributes: ['id', 'name'],
                transaction
              });
            }
            break;
          case 'activity':
            entityModel = 'Activity';
            try {
              // Log before querying to help debug
              logger.info('Attempting to validate activity', { id: entity.id });
              
              // Use the Activity model to validate activities
              const activity = await Activity.findByPk(entity.id, { transaction });
              entityFound = activity !== null;
              
              logger.info('Activity validation result', { 
                id: entity.id, 
                found: entityFound,
                activityExists: activity ? true : false
              });
              
              if (!entityFound) {
                // Get list of available activities for better error message
                const activities = await Activity.findAll({
                  attributes: ['id', 'name'],
                  transaction
                });
                
                availableEntities = activities;
                
                logger.info('Available activities', { 
                  count: activities.length,
                  activities: activities.map(a => ({ id: a.id, name: a.name }))
                });
              }
            } catch (error: any) {
              logger.error('Error validating activity', { 
                id: entity.id, 
                error: error?.message || 'Unknown error'
              });
              entityFound = false;
            }
            break;
          default:
            entityModel = 'Project';
            entityFound = await Project.findByPk(entity.id, { transaction }) !== null;
            
            if (!entityFound) {
              // Get list of available projects for better error message
              availableEntities = await Project.findAll({
                attributes: ['id', 'name'],
                transaction
              });
            }
        }
        
        if (!entityFound) {
          logger.warn(`${entityModel} not found`, { id: entity.id, entityType });
          return { 
            success: false, 
            status: 404, 
            message: `${entityModel} with ID ${entity.id} not found`, 
            availableEntities: availableEntities.map(e => ({ id: e.id, name: e.name }))
          };
        }

        // Verify user has access to this entity if req.user.allowedProgramIds exists
        if (req.user && req.user.allowedProgramIds && 
            !req.user.allowedProgramIds.includes(entity.id)) {
          logger.warn('User does not have access to entity', { 
            userId: req.user.id, 
            entityId: entity.id
          });
          return { success: false, status: 403, message: `You do not have access to ${entity.type} with ID ${entity.id}` };
        }
      }
      
      // Check if a form with the same name already exists
      const existingTemplate = await FormTemplate.findOne({
        where: { name },
        transaction
      });
      
      if (existingTemplate) {
        logger.warn('Form template with this name already exists', { name });
        return { 
          success: false, 
          status: 409, 
          message: "A form template with this name already exists" 
        };
      }

      // Create the form template
      logger.info('Creating form template', { name, includeBeneficiaries });
      const formTemplate = await FormTemplate.create({
        id: uuidv4(),
        name,
        schema,
        version: 1,
        includeBeneficiaries: includeBeneficiaries === true
      }, { transaction });
      
      // Create associations with entities
      for (const entity of entities) {
        await FormEntityAssociation.create({
          id: uuidv4(),
          formTemplateId: formTemplate.id,
          entityId: entity.id,
          entityType: entity.type
        }, { transaction });
      }
      
      // Create audit log entry
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'FORM_TEMPLATE_CREATE',
        description: `Created form template '${name}'`,
        details: JSON.stringify({
          templateId: formTemplate.id,
          version: 1,
          entities: entities.map(e => ({ id: e.id, type: e.type }))
        }),
        timestamp: new Date()
      }, { transaction });
      
      // Register form fields for KPI calculations
      await kpiCalculationService.registerFormFields(formTemplate);

      // Fetch the associations to include in the response
      const entityAssociations = await FormEntityAssociation.findAll({
        where: { formTemplateId: formTemplate.id },
        transaction
      });
      
      // Return the created template with its associations
      return {
        success: true,
        formTemplate,
        entityAssociations
      };
    });

    // Handle transaction result
    if (!result.success) {
      return res.status(result.status || 500).json({
        success: false,
        message: result.message || "Failed to create form template"
      });
    }

    // At this point, we know result.success is true, so formTemplate and entityAssociations should exist
    if (!result.formTemplate) {
      logger.error('Unexpected error: Form template not created');
      return res.status(500).json({
        success: false,
        message: "Unexpected error: Form template not created"
      });
    }

    // Use type assertion to tell TypeScript that formTemplate is defined
    const formTemplate = result.formTemplate as any;
    logger.info('Form template created successfully', { templateId: formTemplate.id });
    return res.status(201).json({
      success: true,
      formTemplate: formTemplate,
      entityAssociations: result.entityAssociations || []
    });
  } catch (error) {
    logger.error('Error creating form template', { error });
    return res.status(500).json({
      success: false,
      message: "An error occurred while creating the form template"
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
    const { name, schema, entities, includeBeneficiaries } = req.body;
    
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

      // Verify user has access to at least one of the associated entities if req.user.allowedProgramIds exists
      if (req.user && req.user.allowedProgramIds && template.entityAssociations) {
        const hasAccess = template.entityAssociations.some(ea => 
          req.user.allowedProgramIds!.includes(ea.entityId)
        );
        
        if (!hasAccess) {
          logger.warn('User does not have access to any entities associated with this template', { 
            userId: req.user.id, 
            templateId: id 
          });
          return { 
            success: false, 
            status: 403, 
            message: "You do not have access to any entities associated with this form template" 
          };
        }
      }
      
      // Check if a form with the new name already exists
      if (name && name !== template.name) {
        // Get all entity IDs associated with this template
        const entityIds = template.entityAssociations?.map(ea => ea.entityId) || [];
        
        // Check if there's another template with the same name associated with any of these entities
        if (entityIds.length > 0) {
          const existingTemplates = await FormTemplate.findAll({
            include: [{
              model: FormEntityAssociation,
              as: 'entityAssociations',
              where: {
                entityId: { [Op.in]: entityIds }
              }
            }],
            where: {
              name,
              id: { [Op.ne]: id } // Exclude current template
            },
            transaction
          });
          
          if (existingTemplates.length > 0) {
            logger.warn('Another form template with this name already exists for these entities', { name });
            return { 
              success: false, 
              status: 409, 
              message: "Another form template with this name already exists for one or more of the associated entities" 
            };
          }
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
      const updateData: any = {
        name: name || template.name,
        schema: schema || template.schema,
        version: newVersion,
      };
      
      // Only update includeBeneficiaries if it's explicitly provided
      if (includeBeneficiaries !== undefined) {
        updateData.includeBeneficiaries = includeBeneficiaries === true;
      }
      
      const [updated] = await FormTemplate.update(
        updateData,
        {
          where: { id },
          transaction
        }
      );

      if (!updated) {
        logger.warn('Form template update failed', { templateId: id });
        return { success: false, status: 500, message: "Failed to update form template" };
      }

      // Update entity associations if provided
      if (entities && Array.isArray(entities)) {
        // Validate entities
        for (const entity of entities) {
          if (!entity.id || !entity.type || !validEntityTypes.includes(entity.type)) {
            return { success: false, status: 400, message: "Invalid entity in entities array" };
          }
        }
        
        // Delete existing associations
        await FormEntityAssociation.destroy({
          where: { formTemplateId: id },
          transaction
        });
        
        // Create new associations
        for (const entity of entities) {
          await FormEntityAssociation.create({
            id: uuidv4(),
            formTemplateId: id,
            entityId: entity.id,
            entityType: entity.type
          }, { transaction });
        }
      }

      // Get updated template with new associations
      const updatedTemplate = await FormTemplate.findByPk(id, {
        include: [{
          model: FormEntityAssociation,
          as: 'entityAssociations'
        }],
        transaction
      });
      
      // Create audit log entry
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'FORM_TEMPLATE_UPDATE',
        description: `Updated form template '${updatedTemplate!.name}'`,
        details: JSON.stringify({
          templateId: id,
          oldVersion: template.version,
          newVersion: newVersion,
          entityAssociations: updatedTemplate?.entityAssociations?.map(ea => ({
            entityId: ea.entityId,
            entityType: ea.entityType
          })),
          schemaChanged: isSchemaChanged
        }),
        timestamp: new Date()
      }, { transaction });
      
      // Re-register form fields for KPI calculations
      if (schema) {
        await kpiCalculationService.registerFormFields({ ...template.toJSON(), schema });
      }

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
 * Get form templates by entity (project, subproject, activity) with flexible filtering
 * All query parameters are optional. When no parameters are provided, returns all templates.
 */
export const getFormTemplatesByEntity = async (req: Request, res: Response) => {
  // Parse query parameters - all are optional
  const { projectId, subprojectId, activityId, entityType } = req.query;
  const entityId = projectId || subprojectId || activityId;
  
  // Parse pagination parameters
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = (page - 1) * limit;

  logger.info('Getting form templates', { projectId, subprojectId, activityId, entityType, page, limit });

  try {
    // Check if we need to filter by entity associations at all
    const hasEntityFilter = entityId || entityType;
    let formTemplateIds: string[] = [];
    
    // Only query FormEntityAssociation if we have entity filters
    if (hasEntityFilter) {
      // Build where clause for the FormEntityAssociation query
      let whereClause: any = {};
      
      // If specific entity ID is provided, filter by it
      if (entityId) {
        whereClause.entityId = entityId;
        
        // Verify user has access to this entity if req.user.allowedProgramIds exists
        if (req.user && req.user.allowedProgramIds && 
            !req.user.allowedProgramIds.includes(entityId as string)) {
          logger.warn('User does not have access to entity', { 
            userId: req.user.id, 
            entityId 
          });
          return res.status(403).json({
            success: false,
            message: "You do not have access to this entity",
          });
        }
      } else if (req.user && req.user.allowedProgramIds) {
        // If no specific entity ID is provided but user has access restrictions,
        // limit to entities the user has access to
        whereClause.entityId = {
          [Op.in]: req.user.allowedProgramIds
        };
      }
      
      // Add entityType filter if provided
      if (entityType) {
        // Handle multiple entity types separated by commas
        const entityTypes = (entityType as string).split(',');
        const validEntityTypes = ['project', 'subproject', 'activity'];
        
        // Filter out invalid entity types
        const filteredTypes = entityTypes.filter(type => validEntityTypes.includes(type));
        
        if (filteredTypes.length > 0) {
          whereClause.entityType = {
            [Op.in]: filteredTypes
          };
        }
      } else {
        // Determine entity type based on which ID was provided
        if (projectId) {
          whereClause.entityType = 'project';
        } else if (subprojectId) {
          whereClause.entityType = 'subproject';
        } else if (activityId) {
          whereClause.entityType = 'activity';
        }
      }
      
      // Get form template IDs associated with these entities
      const associations = await FormEntityAssociation.findAll({
        where: whereClause,
        attributes: ['formTemplateId']
      });
      
      formTemplateIds = associations.map(assoc => assoc.formTemplateId);
      
      if (formTemplateIds.length === 0 && hasEntityFilter) {
        // No templates associated with these entities
        return res.status(200).json({
          success: true,
          data: {
            templates: [],
            pagination: {
              page,
              limit,
              totalPages: 0,
              totalCount: 0
            }
          }
        });
      }
    }
    
    // Get templates with pagination - either filtered by entity or all templates
    let whereClause = {};
    let includeClause = [{
      model: FormEntityAssociation,
      as: 'entityAssociations'
    }];
    
    // If we have entity filters, use the formTemplateIds to filter templates
    if (hasEntityFilter && formTemplateIds.length > 0) {
      whereClause = {
        id: {
          [Op.in]: formTemplateIds
        }
      };
    } else if (hasEntityFilter && formTemplateIds.length === 0) {
      // No templates match the entity filters
      return res.status(200).json({
        success: true,
        data: {
          templates: [],
          pagination: {
            page,
            limit,
            totalPages: 0,
            totalCount: 0
          }
        }
      });
    }
    
    // Apply user access restrictions if needed
    if (req.user && req.user.allowedProgramIds && req.user.allowedProgramIds.length > 0 && !hasEntityFilter) {
      // If no entity filters but user has access restrictions, we need to filter by associated entities
      includeClause = [{
        model: FormEntityAssociation,
        as: 'entityAssociations',
        // @ts-ignore - Sequelize typing issue
        where: {
          entityId: {
            [Op.in]: req.user.allowedProgramIds
          }
        }
      }];
    }
    
    // Get templates with pagination
    const [templates, totalCount] = await Promise.all([
      FormTemplate.findAll({
        where: whereClause,
        include: includeClause,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
        // @ts-ignore - Sequelize typing issue
        distinct: true
      }),
      FormTemplate.count({
        where: whereClause,
        include: includeClause,
        // @ts-ignore - Sequelize typing issue
        distinct: true
      })
    ]);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);

    logger.info('Successfully retrieved form templates', { 
      entityId,
      entityType: entityType || 'all',
      count: templates.length,
      page,
      totalPages
    });

    // Enrich associations across all templates with entityName and status using bulk queries
    const allAssociations = templates.flatMap((t: any) => t.entityAssociations || []);

    const projectIds = Array.from(new Set(allAssociations
      .filter((ea: any) => ea.entityType === 'project')
      .map((ea: any) => ea.entityId)));
    const subprojectIds = Array.from(new Set(allAssociations
      .filter((ea: any) => ea.entityType === 'subproject')
      .map((ea: any) => ea.entityId)));
    const activityIds = Array.from(new Set(allAssociations
      .filter((ea: any) => ea.entityType === 'activity')
      .map((ea: any) => ea.entityId)));

    const [projects, subprojects, activities] = await Promise.all([
      projectIds.length ? Project.findAll({ where: { id: { [Op.in]: projectIds } }, attributes: ['id','name','status'] }) : Promise.resolve([]),
      subprojectIds.length ? Subproject.findAll({ where: { id: { [Op.in]: subprojectIds } }, attributes: ['id','name','status'] }) : Promise.resolve([]),
      activityIds.length ? Activity.findAll({ where: { id: { [Op.in]: activityIds } }, attributes: ['id','name','status'] }) : Promise.resolve([]),
    ]);

    const projectMap = new Map(projects.map((p: any) => [p.id, p]));
    const subprojectMap = new Map(subprojects.map((s: any) => [s.id, s]));
    const activityMap = new Map(activities.map((a: any) => [a.id, a]));

    const enrichedTemplates = templates.map((t: any) => {
      const tJson = t.toJSON();
      const associations = tJson.entityAssociations || [];
      const enrichedAssociations = associations.map((ea: any) => {
        let entity: any = null;
        if (ea.entityType === 'project') entity = projectMap.get(ea.entityId);
        else if (ea.entityType === 'subproject') entity = subprojectMap.get(ea.entityId);
        else if (ea.entityType === 'activity') entity = activityMap.get(ea.entityId);
        return {
          ...ea,
          entityName: entity?.name ?? null,
          status: entity?.status ?? null,
        };
      });
      return {
        ...tJson,
        entityAssociations: enrichedAssociations,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        templates: enrichedTemplates,
        pagination: {
          page,
          limit,
          totalPages,
          totalCount
        }
      }
    });
  } catch (error) {
    logger.error('Error retrieving form templates', error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving form templates"
    });
  }
};

/**
 * Get form template by ID
 */
export const getFormTemplateById = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Getting form template by ID', { templateId: id });
  
  try {
    // Find template with its entity associations
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

    // Verify user has access to at least one of the associated entities if req.user.allowedProgramIds exists
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

    logger.info('Successfully retrieved form template', { templateId: id });
    // Enrich entity associations with entityName and status
    const associations = template.entityAssociations || [];
    const enrichedAssociations = await Promise.all(
      associations.map(async (ea: any) => {
        let entity: any = null;
        try {
          if (ea.entityType === 'project') {
            entity = await Project.findByPk(ea.entityId, { attributes: ['id', 'name', 'status'] });
          } else if (ea.entityType === 'subproject') {
            entity = await Subproject.findByPk(ea.entityId, { attributes: ['id', 'name', 'status'] });
          } else if (ea.entityType === 'activity') {
            entity = await Activity.findByPk(ea.entityId, { attributes: ['id', 'name', 'status'] });
          }
        } catch (e) {
          logger.warn('Failed to enrich entity association', { associationId: ea.id, entityType: ea.entityType, entityId: ea.entityId });
        }
        const json = ea.toJSON ? ea.toJSON() : ea;
        return {
          ...json,
          entityName: entity?.name ?? null,
          status: entity?.status ?? null,
        };
      })
    );

    const enrichedTemplate = {
      ...template.toJSON(),
      entityAssociations: enrichedAssociations,
    };

    return res.status(200).json({
      success: true,
      data: enrichedTemplate,
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

      // Verify user has access to at least one of the associated entities if req.user.allowedProgramIds exists
      if (req.user && req.user.allowedProgramIds && template.entityAssociations) {
        const hasAccess = template.entityAssociations.some(ea => 
          req.user.allowedProgramIds!.includes(ea.entityId)
        );
        
        if (!hasAccess) {
          logger.warn('User does not have access to any entities associated with this template', { 
            userId: req.user.id, 
            templateId: id 
          });
          return { 
            success: false, 
            status: 403, 
            message: "You do not have access to any entities associated with this form template" 
          };
        }
      }

      // Delete all entity associations first
      if (template.entityAssociations && template.entityAssociations.length > 0) {
        await FormEntityAssociation.destroy({
          where: { formTemplateId: id },
          transaction
        });
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
          entityAssociations: template.entityAssociations?.map(ea => ({
            entityId: ea.entityId,
            entityType: ea.entityType
          })),
          version: template.version
        }),
        timestamp: new Date()
      }, { transaction });

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
    logger.error(`Error deleting form template with ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: `Error deleting form template: ${error.message}`,
    });
  }
};

/**
 * Set form template status to inactive
 */
export const setFormTemplateInactive = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Setting form template inactive', { templateId: id });

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const template = await FormTemplate.findByPk(id, {
        include: [{
          model: FormEntityAssociation,
          as: 'entityAssociations'
        }],
        transaction
      });

      if (!template) {
        logger.warn('Form template not found', { templateId: id });
        return { success: false, status: 404, message: 'Form template not found' };
      }

      // Access check: user must have access to at least one associated entity
      if (req.user && req.user.allowedProgramIds && template.entityAssociations) {
        const hasAccess = template.entityAssociations.some(ea => req.user!.allowedProgramIds!.includes(ea.entityId));
        if (!hasAccess) {
          logger.warn('User does not have access to any entities associated with this template', { userId: req.user.id, templateId: id });
          return { success: false, status: 403, message: 'You do not have access to any entities associated with this form template' };
        }
      }
      
      const desiredStatus = (req.body?.status as string)?.toLowerCase();
      const validStatuses = ['active', 'inactive'];
      if (!desiredStatus || !validStatuses.includes(desiredStatus)) {
        return { success: false, status: 400, message: "Invalid or missing status. Expected 'active' or 'inactive'" };
      }

      if ((template as any).status === desiredStatus) {
        return { success: true, status: 200, message: `Template already ${desiredStatus}`, data: template };
      }

      await FormTemplate.update({ status: desiredStatus } as any, { where: { id }, transaction });

      const updated = await FormTemplate.findByPk(id, { transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: desiredStatus === 'inactive' ? 'FORM_TEMPLATE_INACTIVATE' : 'FORM_TEMPLATE_ACTIVATE',
        description: `Set form template '${template.name}' ${desiredStatus}`,
        details: JSON.stringify({ templateId: id, previousStatus: (template as any).status, newStatus: desiredStatus }),
        timestamp: new Date()
      }, { transaction });

      return { success: true, status: 200, message: `Template set to ${desiredStatus}`, data: updated };
    });

    if (!result.success) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.status(result.status).json({ success: true, message: result.message, data: result.data });
  } catch (error: any) {
    logger.error(`Error setting form template inactive ID: ${id}`, error);
    return res.status(500).json({ success: false, message: `Error setting template inactive: ${error.message}` });
  }
};

/**
 * Permanently delete a form template (hard delete)
 */
export const hardDeleteFormTemplate = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Hard deleting form template', { templateId: id });

  try {
    const result = await sequelize.transaction(async (transaction) => {
      // Include soft-deleted too when looking up, to allow hard-deleting already soft-deleted records
      const template = await FormTemplate.findByPk(id, {
        include: [{
          model: FormEntityAssociation,
          as: 'entityAssociations'
        }],
        paranoid: false,
        transaction
      });

      if (!template) {
        logger.warn('Form template not found', { templateId: id });
        return { success: false, status: 404, message: 'Form template not found' };
      }

      // Access check
      if (req.user && req.user.allowedProgramIds && template.entityAssociations) {
        const hasAccess = template.entityAssociations.some(ea => req.user!.allowedProgramIds!.includes(ea.entityId));
        if (!hasAccess) {
          logger.warn('User does not have access to any entities associated with this template', { userId: req.user.id, templateId: id });
          return { success: false, status: 403, message: 'You do not have access to any entities associated with this form template' };
        }
      }

      // Remove associations first
      if (template.entityAssociations && template.entityAssociations.length > 0) {
        await FormEntityAssociation.destroy({ where: { formTemplateId: id }, force: true, transaction });
      }

      // Hard delete the template
      await (template as any).destroy({ force: true, transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'FORM_TEMPLATE_HARD_DELETE',
        description: `Hard deleted form template '${template.name}'`,
        details: JSON.stringify({ templateId: id, version: template.version }),
        timestamp: new Date()
      }, { transaction });

      return { success: true, status: 200, message: 'Form template permanently deleted' };
    });

    if (!result.success) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    return res.status(result.status).json({ success: true, message: result.message });
  } catch (error: any) {
    logger.error(`Error hard deleting form template with ID: ${id}`, error);
    return res.status(500).json({ success: false, message: `Error hard deleting form template: ${error.message}` });
  }
};

export default {
  createFormTemplate,
  updateFormTemplate,
  getFormTemplateById,
  getFormTemplatesByEntity,
  deleteFormTemplate,
  setFormTemplateInactive,
  hardDeleteFormTemplate
};
