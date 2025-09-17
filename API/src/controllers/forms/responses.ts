import { Request, Response } from "express";
import { FormTemplate, FormResponse, User, AuditLog, Beneficiary, ServiceAssignment, ServiceDelivery, Activity, Service, Subproject } from "../../models";
import FormEntityAssociation from "../../models/FormEntityAssociation";
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../utils/logger";
import { Op, literal } from "sequelize";
import sequelize from "../../db/connection";
import validateFormResponse from "../../services/forms/validateFormResponse";
import { ROLES } from "../../constants/roles";

// Create a logger instance for this module
const logger = createLogger('forms-responses-controller');

// Helper: get current user's role names. If not preloaded by middleware, load from DB.
const getUserRoleNames = async (req: Request): Promise<string[]> => {
  const cached = (req as any).userRoles as any[] | undefined;
  if (Array.isArray(cached) && cached.length) {
    return cached.map((r: any) => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
  }
  if (!req.user) return [];
  try {
    const u = await User.findByPk(req.user.id, {
      include: [{ association: 'roles' }]
    }) as any;
    const roles = (u?.roles || []) as any[];
    return roles.map((r: any) => r?.name).filter(Boolean);
  } catch (_) {
    return [];
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

      // Direct beneficiary association: accept beneficiaryId from request (optional)
      let beneficiaryId: string | undefined = req.body.beneficiaryId || undefined;
      if (beneficiaryId) {
        const exists = await Beneficiary.findByPk(beneficiaryId, { transaction });
        if (!exists) {
          logger.warn('Provided beneficiaryId not found', { beneficiaryId });
          return { success: false, status: 400, message: 'Invalid beneficiaryId: beneficiary not found' };
        }
      }

      // No PII redaction needed now that we do not map PII from form fields
      const sanitizedData: any = validationResult.data;

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

      // If services were provided, create service deliveries
      const servicesInput = Array.isArray(req.body.services) ? req.body.services : [];
      let createdDeliveries = 0;
      let skippedDeliveries: Array<{ serviceId: string; reason: string }> = [];
      let unassignedNotBlocked = 0;

      if (servicesInput.length > 0) {
        // Determine allowed serviceIds for this entity, considering hierarchy
        const allowedServiceIds = new Set<string>();

        if (entityType === 'project') {
          const assignments = await ServiceAssignment.findAll({ where: { entityId, entityType: 'project' }, transaction });
          for (const a of assignments) allowedServiceIds.add(a.get('serviceId') as string);
        } else if (entityType === 'subproject') {
          // Include assignments at subproject level and parent project level
          const [subAssignments, sub] = await Promise.all([
            ServiceAssignment.findAll({ where: { entityId, entityType: 'subproject' }, transaction }),
            Subproject.findByPk(entityId, { transaction }),
          ]);
          for (const a of subAssignments) allowedServiceIds.add(a.get('serviceId') as string);
          const projectId = sub?.get('projectId') as string | undefined;
          if (projectId) {
            const projAssignments = await ServiceAssignment.findAll({ where: { entityId: projectId, entityType: 'project' }, transaction });
            for (const a of projAssignments) allowedServiceIds.add(a.get('serviceId') as string);
          }
        } else if (entityType === 'activity') {
          // Include assignments at the activity's subproject and its parent project
          const activity = await Activity.findByPk(entityId, { transaction });
          const subprojectId = activity?.get('subprojectId') as string | undefined;
          if (subprojectId) {
            const [subAssignments, sub] = await Promise.all([
              ServiceAssignment.findAll({ where: { entityId: subprojectId, entityType: 'subproject' }, transaction }),
              Subproject.findByPk(subprojectId, { transaction }),
            ]);
            for (const a of subAssignments) allowedServiceIds.add(a.get('serviceId') as string);
            const projectId = sub?.get('projectId') as string | undefined;
            if (projectId) {
              const projAssignments = await ServiceAssignment.findAll({ where: { entityId: projectId, entityType: 'project' }, transaction });
              for (const a of projAssignments) allowedServiceIds.add(a.get('serviceId') as string);
            }
          }
        }

        for (const item of servicesInput) {
          const serviceId = item?.serviceId as string | undefined;
          if (!serviceId) {
            skippedDeliveries.push({ serviceId: 'unknown', reason: 'missing serviceId' });
            continue;
          }
          if (!beneficiaryId) {
            skippedDeliveries.push({ serviceId, reason: 'no beneficiary linked' });
            continue;
          }

          // Previously we skipped if serviceId was not assigned to the entity when there were some assignments.
          // Business decision: proceed to create delivery but log a warning for visibility.
          if (allowedServiceIds.size > 0 && !allowedServiceIds.has(serviceId)) {
            logger.warn('Service not assigned to entity; proceeding to create ServiceDelivery per relaxed policy', {
              entityId,
              entityType,
              serviceId,
              beneficiaryId,
            });
            unassignedNotBlocked += 1;
          }

          const deliveredAt = item?.deliveredAt ? new Date(item.deliveredAt) : new Date();
          const staffUserId = (item?.staffUserId as string | undefined) || req.user.id;
          const notes = (item?.notes as string | undefined) || null;

          await ServiceDelivery.create({
            id: uuidv4(),
            serviceId,
            beneficiaryId,
            entityId,
            entityType,
            formResponseId: formResponse.id,
            staffUserId,
            deliveredAt,
            notes,
          }, { transaction });
          createdDeliveries += 1;
        }
      }

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
          beneficiaryId: beneficiaryId ?? null,
          services: {
            requested: Array.isArray(req.body.services) ? req.body.services.length : 0,
            created: createdDeliveries,
            skipped: skippedDeliveries,
            unassignedNotBlocked,
          }
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
      
      // Verify user has access to this entity if req.user.allowedProgramIds exists (map subproject/activity to parent project)
      // Admins bypass this check
      const roleNamesPre = await getUserRoleNames(req);
      const isAdminPre = roleNamesPre.includes(ROLES.SUPER_ADMIN) || roleNamesPre.includes(ROLES.SYSTEM_ADMINISTRATOR);
      if (!isAdminPre && req.user && Array.isArray(req.user.allowedProgramIds) && req.user.allowedProgramIds.length > 0) {
        const allowed = new Set<string>((req.user.allowedProgramIds as any).map(String));
        const et = String(entityType);
        const eid = String(entityId);
        let projectIdToCheck: string | null = null;
        if (et === 'project') {
          projectIdToCheck = eid;
        } else if (et === 'subproject') {
          const sub = await Subproject.findByPk(eid, { attributes: ['projectId'] });
          projectIdToCheck = sub ? String(sub.get('projectId')) : null;
        } else if (et === 'activity') {
          const act = await Activity.findByPk(eid, { attributes: ['subprojectId'] });
          const subId = act ? String(act.get('subprojectId')) : null;
          if (subId) {
            const sub = await Subproject.findByPk(subId, { attributes: ['projectId'] });
            projectIdToCheck = sub ? String(sub.get('projectId')) : null;
          }
        }
        if (!projectIdToCheck || !allowed.has(projectIdToCheck)) {
          logger.warn('User does not have access to entity', { userId: req.user.id, entityId: eid, entityType: et, projectIdToCheck });
          return res.status(403).json({ success: false, message: 'You do not have access to this entity' });
        }
      }
    } else {
      // If no specific entity is requested, skip early reject and rely on RBAC filters below
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

    // Optional additional filters
    const beneficiaryId = (req.query.beneficiaryId as string) || undefined;
    const beneficiaryIds = req.query.beneficiaryIds ? String(req.query.beneficiaryIds).split(',').filter(Boolean) : undefined;
    const serviceId = (req.query.serviceId as string) || undefined;
    const serviceIds = req.query.serviceIds ? String(req.query.serviceIds).split(',').filter(Boolean) : undefined;

    if (beneficiaryId) whereClause.beneficiaryId = beneficiaryId;
    if (beneficiaryIds && beneficiaryIds.length) whereClause.beneficiaryId = { [Op.in]: beneficiaryIds };

    const ands: any[] = [];
    // RBAC visibility rules
    const roleNames = await getUserRoleNames(req);
    const isAdmin = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
    const isManager = roleNames.includes(ROLES.PROGRAM_MANAGER) || roleNames.includes(ROLES.SUB_PROJECT_MANAGER);
    const allowed = (req.user && Array.isArray((req.user as any).allowedProgramIds)) ? ((req.user as any).allowedProgramIds as string[]) : [];
    if (isAdmin) {
      // no additional constraints
    } else if (isManager && allowed.length) {
      const esc = (v: string) => String(v).replace(/'/g, "''");
      const list = allowed.map(id => `'${esc(id)}'`).join(',');
      const scopeOr: any[] = [];
      scopeOr.push(literal(`("entityType" = 'project' AND "entityId" IN (${list}))`));
      scopeOr.push(literal(`("entityType" = 'subproject' AND "entityId" IN (SELECT id FROM subprojects WHERE "projectId" IN (${list})))`));
      scopeOr.push(literal(`("entityType" = 'activity' AND "entityId" IN (SELECT a.id FROM activities a JOIN subprojects s ON a."subprojectId" = s.id WHERE s."projectId" IN (${list})))`));
      ands.push({ [Op.or]: scopeOr });
    } else {
      // Field Operator or other roles: only own submissions
      (whereClause as any).submittedBy = req.user.id;
    }
    if (serviceId) {
      ands.push(literal(`id IN (SELECT "formResponseId" FROM service_deliveries WHERE "serviceId" = '${String(serviceId).replace(/'/g, "''")}')`));
    }
    if (serviceIds && serviceIds.length) {
      const list = serviceIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
      ands.push(literal(`id IN (SELECT "formResponseId" FROM service_deliveries WHERE "serviceId" IN (${list}))`));
    }
    if (ands.length) {
      (whereClause as any)[Op.and] = [ ...(((whereClause as any)[Op.and] as any[]) || []), ...ands ];
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
          },
          {
            model: ServiceDelivery,
            as: 'serviceDeliveries',
            attributes: ['id', 'serviceId', 'deliveredAt', 'staffUserId', 'notes'],
            include: [
              { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
              { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'email'] }
            ]
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

/**
 * Get responses by entity (project, subproject, activity)
 */
export const getResponsesByEntity = async (req: Request, res: Response) => {
  try {
    // Required params
    const entityId = (req.query.entityId as string) || '';
    const entityType = (req.query.entityType as string) || '';

    if (!entityId || !entityType) {
      return res.status(400).json({
        success: false,
        message: "entityId and entityType are required",
      });
    }

    if (!['project', 'subproject', 'activity'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: "entityType must be one of 'project', 'subproject', or 'activity'",
      });
    }

    // Optional filters
    const templateId = (req.query.templateId as string) || undefined;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limitRaw = parseInt(req.query.limit as string) || 20;
    const limit = Math.max(1, Math.min(limitRaw, 100));
    const offset = (page - 1) * limit;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : null;

    logger.info('Getting form responses by entity', { entityId, entityType, templateId, page, limit });

    // Access control: verify user can access the entity (map to parent project). Admins bypass.
    const roleNamesPre = await getUserRoleNames(req);
    const isAdminPre = roleNamesPre.includes(ROLES.SUPER_ADMIN) || roleNamesPre.includes(ROLES.SYSTEM_ADMINISTRATOR);
    if (!isAdminPre && req.user && Array.isArray(req.user.allowedProgramIds) && req.user.allowedProgramIds.length > 0) {
      const allowed = new Set<string>((req.user.allowedProgramIds as any).map(String));
      let projectIdForAuth: string | null = null;
      if (entityType === 'project') {
        projectIdForAuth = entityId;
      } else if (entityType === 'subproject') {
        const sub = await Subproject.findByPk(entityId, { attributes: ['projectId'] });
        projectIdForAuth = sub ? String(sub.get('projectId')) : null;
      } else if (entityType === 'activity') {
        const act = await Activity.findByPk(entityId, { attributes: ['subprojectId'] });
        const subId = act ? String(act.get('subprojectId')) : null;
        if (subId) {
          const sub = await Subproject.findByPk(subId, { attributes: ['projectId'] });
          projectIdForAuth = sub ? String(sub.get('projectId')) : null;
        }
      }
      if (!projectIdForAuth || !allowed.has(projectIdForAuth)) {
        logger.warn('User does not have access to entity', { userId: req.user.id, entityId, entityType, projectIdForAuth });
        return res.status(403).json({ success: false, message: 'You do not have access to this entity' });
      }
    }

    // If templateId provided, ensure template exists and is associated with the entity
    if (templateId) {
      const template = await FormTemplate.findByPk(templateId, {
        include: [{ model: FormEntityAssociation, as: 'entityAssociations' }]
      });
      if (!template) {
        return res.status(404).json({ success: false, message: 'Form template not found' });
      }
      const associated = template.entityAssociations?.some(ea => ea.entityId === entityId && ea.entityType === entityType);
      if (!associated) {
        return res.status(400).json({ success: false, message: 'This entity is not associated with the specified form template' });
      }
    }

    // Build where clause
    const whereClause: any = { entityId, entityType };
    // RBAC visibility
    const roleNames = await getUserRoleNames(req);
    const isAdmin = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
    const isManager = roleNames.includes(ROLES.PROGRAM_MANAGER) || roleNames.includes(ROLES.SUB_PROJECT_MANAGER);
    if (!(isAdmin || isManager)) {
      whereClause.submittedBy = req.user.id;
    }
    if (templateId) whereClause.formTemplateId = templateId;
    if (fromDate && toDate) {
      whereClause.submittedAt = { [Op.between]: [fromDate, toDate] };
    } else if (fromDate) {
      whereClause.submittedAt = { [Op.gte]: fromDate };
    } else if (toDate) {
      whereClause.submittedAt = { [Op.lte]: toDate };
    }

    // Optional additional filters
    const beneficiaryId = (req.query.beneficiaryId as string) || undefined;
    const beneficiaryIds = req.query.beneficiaryIds ? String(req.query.beneficiaryIds).split(',').filter(Boolean) : undefined;
    const serviceId = (req.query.serviceId as string) || undefined;
    const serviceIds = req.query.serviceIds ? String(req.query.serviceIds).split(',').filter(Boolean) : undefined;

    if (beneficiaryId) whereClause.beneficiaryId = beneficiaryId;
    if (beneficiaryIds && beneficiaryIds.length) whereClause.beneficiaryId = { [Op.in]: beneficiaryIds };

    const ands: any[] = [];
    if (serviceId) {
      ands.push(literal(`id IN (SELECT "formResponseId" FROM service_deliveries WHERE "serviceId" = '${String(serviceId).replace(/'/g, "''")}')`));
    }
    if (serviceIds && serviceIds.length) {
      const list = serviceIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
      ands.push(literal(`id IN (SELECT "formResponseId" FROM service_deliveries WHERE "serviceId" IN (${list}))`));
    }
    if (ands.length) {
      (whereClause as any)[Op.and] = [ ...(((whereClause as any)[Op.and] as any[]) || []), ...ands ];
    }

    const [responses, totalCount] = await Promise.all([
      FormResponse.findAll({
        where: whereClause,
        limit,
        offset,
        order: [['submittedAt', 'DESC']],
        include: [
          { model: FormTemplate, as: 'template', attributes: ['id', 'name', 'version'] },
          { model: User, as: 'submitter', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: Beneficiary, as: 'beneficiary', attributes: ['id', 'pseudonym', 'status'] },
          {
            model: ServiceDelivery,
            as: 'serviceDeliveries',
            attributes: ['id', 'serviceId', 'deliveredAt', 'staffUserId', 'notes'],
            include: [
              { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
              { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'email'] }
            ]
          }
        ]
      }),
      FormResponse.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    return res.status(200).json({
      success: true,
      data: responses,
      meta: { page, limit, totalPages, totalItems: totalCount }
    });
  } catch (error: any) {
    logger.error('Error fetching form responses by entity', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get all form responses (optionally filtered)
 */
export const getAllResponses = async (req: Request, res: Response) => {
  try {
    const templateId = (req.query.templateId as string) || undefined;
    const entityId = (req.query.entityId as string) || undefined;
    const entityType = (req.query.entityType as string) || undefined;
    const page = Math.max(parseInt(req.query.page as string) || 1, 1);
    const limitRaw = parseInt(req.query.limit as string) || 20;
    const limit = Math.max(1, Math.min(limitRaw, 100));
    const offset = (page - 1) * limit;
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : null;
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : null;

    // Base where clause
    const whereClause: any = {};
    if (templateId) whereClause.formTemplateId = templateId;
    if (entityId) whereClause.entityId = entityId;
    if (entityType) whereClause.entityType = entityType;
    if (fromDate && toDate) {
      whereClause.submittedAt = { [Op.between]: [fromDate, toDate] };
    } else if (fromDate) {
      whereClause.submittedAt = { [Op.gte]: fromDate };
    } else if (toDate) {
      whereClause.submittedAt = { [Op.lte]: toDate };
    }

    // Additional optional filters
    const formTemplateIds = req.query.formTemplateIds ? String(req.query.formTemplateIds).split(',').filter(Boolean) : undefined;
    const beneficiaryId = (req.query.beneficiaryId as string) || undefined;
    const beneficiaryIds = req.query.beneficiaryIds ? String(req.query.beneficiaryIds).split(',').filter(Boolean) : undefined;
    const serviceId = (req.query.serviceId as string) || undefined;
    const serviceIds = req.query.serviceIds ? String(req.query.serviceIds).split(',').filter(Boolean) : undefined;
    const projectId = (req.query.projectId as string) || undefined;
    const subprojectId = (req.query.subprojectId as string) || undefined;
    const activityId = (req.query.activityId as string) || undefined;
    const userIdFilter = (req.query.userId as string) || undefined;
    const userIdsFilter = req.query.userIds ? String(req.query.userIds).split(',').filter(Boolean) : undefined;

    if (formTemplateIds && formTemplateIds.length) whereClause.formTemplateId = { [Op.in]: formTemplateIds };
    if (beneficiaryId) whereClause.beneficiaryId = beneficiaryId;
    if (beneficiaryIds && beneficiaryIds.length) whereClause.beneficiaryId = { [Op.in]: beneficiaryIds };

    const ands: any[] = [];

    // Service subquery filters
    if (serviceId) {
      ands.push(literal(`id IN (SELECT "formResponseId" FROM service_deliveries WHERE "serviceId" = '${String(serviceId).replace(/'/g, "''")}')`));
    }
    if (serviceIds && serviceIds.length) {
      const list = serviceIds.map(id => `'${String(id).replace(/'/g, "''")}'`).join(',');
      ands.push(literal(`id IN (SELECT "formResponseId" FROM service_deliveries WHERE "serviceId" IN (${list}))`));
    }

    // Hierarchical entity expansion similar to KPI service (explicit query filters)
    const entityScopeOr: any[] = [];
    if (projectId) {
      const pid = String(projectId).replace(/'/g, "''");
      entityScopeOr.push(literal(`("entityType" = 'project' AND "entityId" = '${pid}')`));
      entityScopeOr.push(literal(`("entityType" = 'subproject' AND "entityId" IN (SELECT id FROM subprojects WHERE "projectId" = '${pid}'))`));
      entityScopeOr.push(literal(`("entityType" = 'activity' AND "entityId" IN (SELECT a.id FROM activities a JOIN subprojects s ON a."subprojectId" = s.id WHERE s."projectId" = '${pid}'))`));
    } else if (subprojectId) {
      const sid = String(subprojectId).replace(/'/g, "''");
      entityScopeOr.push(literal(`("entityType" = 'subproject' AND "entityId" = '${sid}')`));
      entityScopeOr.push(literal(`("entityType" = 'activity' AND "entityId" IN (SELECT id FROM activities WHERE "subprojectId" = '${sid}'))`));
    } else if (activityId) {
      whereClause.entityId = activityId;
      whereClause.entityType = 'activity';
    }
    if (entityScopeOr.length) {
      ands.push({ [Op.or]: entityScopeOr });
    }

    // RBAC visibility rules
    const roleNames = await getUserRoleNames(req);
    const isAdmin = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
    const isManager = roleNames.includes(ROLES.PROGRAM_MANAGER) || roleNames.includes(ROLES.SUB_PROJECT_MANAGER);
    const allowed = (req.user && Array.isArray((req.user as any).allowedProgramIds)) ? ((req.user as any).allowedProgramIds as string[]) : [];
    if (isAdmin) {
      // no additional constraints
    } else if (isManager && allowed.length) {
      const esc = (v: string) => String(v).replace(/'/g, "''");
      const list = allowed.map(id => `'${esc(id)}'`).join(',');
      const rbacOr: any[] = [];
      rbacOr.push(literal(`("entityType" = 'project' AND "entityId" IN (${list}))`));
      rbacOr.push(literal(`("entityType" = 'subproject' AND "entityId" IN (SELECT id FROM subprojects WHERE "projectId" IN (${list})))`));
      rbacOr.push(literal(`("entityType" = 'activity' AND "entityId" IN (SELECT a.id FROM activities a JOIN subprojects s ON a."subprojectId" = s.id WHERE s."projectId" IN (${list})))`));
      ands.push({ [Op.or]: rbacOr });
    } else {
      (whereClause as any).submittedBy = req.user.id;
    }

    // submittedBy filters (only effective for Admins/Managers)
    if (isAdmin || isManager) {
      if (userIdFilter) {
        whereClause.submittedBy = userIdFilter;
      } else if (userIdsFilter && userIdsFilter.length) {
        whereClause.submittedBy = { [Op.in]: userIdsFilter };
      }
    }

    if (ands.length) {
      (whereClause as any)[Op.and] = [ ...(((whereClause as any)[Op.and] as any[]) || []), ...ands ];
    }

    // Legacy allowedProgramIds fallback removed; visibility is enforced by role-based rules above

    const [responses, totalCount] = await Promise.all([
      FormResponse.findAll({
        where: whereClause,
        limit,
        offset,
        order: [['submittedAt', 'DESC']],
        include: [
          { model: FormTemplate, as: 'template', attributes: ['id', 'name', 'version'] },
          { model: User, as: 'submitter', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: Beneficiary, as: 'beneficiary', attributes: ['id', 'pseudonym', 'status'] },
          {
            model: ServiceDelivery,
            as: 'serviceDeliveries',
            attributes: ['id', 'serviceId', 'deliveredAt', 'staffUserId', 'notes'],
            include: [
              { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
              { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'email'] }
            ]
          }
        ]
      }),
      FormResponse.count({ where: whereClause })
    ]);

    const totalPages = Math.ceil(totalCount / limit);
    return res.status(200).json({
      success: true,
      data: responses,
      meta: { page, limit, totalPages, totalItems: totalCount }
    });
  } catch (error: any) {
    logger.error('Error fetching all form responses', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get a single form response by ID
 */
export const getFormResponseById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const response = await FormResponse.findByPk(id, {
      include: [
        { model: FormTemplate, as: 'template', attributes: ['id', 'name', 'version'] },
        { model: User, as: 'submitter', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Beneficiary, as: 'beneficiary', attributes: ['id', 'pseudonym', 'status'] },
        {
          model: ServiceDelivery,
          as: 'serviceDeliveries',
          attributes: ['id', 'serviceId', 'deliveredAt', 'staffUserId', 'notes', 'entityId', 'entityType'],
          include: [
            { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
            { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'email'] },
          ],
        },
      ],
    });

    if (!response) {
      return res.status(404).json({ success: false, message: 'Form response not found' });
    }

    // RBAC: admins see all; managers see allowed project scope; others only own submissions
    const roleNames = await getUserRoleNames(req);
    const isAdmin = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
    const isManager = roleNames.includes(ROLES.PROGRAM_MANAGER) || roleNames.includes(ROLES.SUB_PROJECT_MANAGER);
    if (!isAdmin && !isManager) {
      const submittedBy = String(response.get('submittedBy'));
      if (submittedBy !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: 'You do not have access to this response' });
      }
    }

    // RBAC: ensure user can access the entity associated with the response
    const roleNamesId = await getUserRoleNames(req);
    const isAdminId = roleNamesId.includes(ROLES.SUPER_ADMIN) || roleNamesId.includes(ROLES.SYSTEM_ADMINISTRATOR);
    if (!isAdminId && req.user && Array.isArray(req.user.allowedProgramIds) && req.user.allowedProgramIds.length > 0) {
      const allowed = new Set<string>(req.user.allowedProgramIds as any);
      const entityType = response.get('entityType') as 'project' | 'subproject' | 'activity';
      const entityId = String(response.get('entityId'));
      let projectIdToCheck: string | null = null;

      if (entityType === 'project') {
        projectIdToCheck = entityId;
      } else if (entityType === 'subproject') {
        const sub = await Subproject.findByPk(entityId, { attributes: ['projectId'] });
        projectIdToCheck = sub ? String(sub.get('projectId')) : null;
      } else if (entityType === 'activity') {
        const act = await Activity.findByPk(entityId, { attributes: ['subprojectId'] });
        const subId = act ? String(act.get('subprojectId')) : null;
        if (subId) {
          const sub = await Subproject.findByPk(subId, { attributes: ['projectId'] });
          projectIdToCheck = sub ? String(sub.get('projectId')) : null;
        }
      }

      if (!projectIdToCheck || !allowed.has(projectIdToCheck)) {
        return res.status(403).json({ success: false, message: 'You do not have access to this response' });
      }
    }

    return res.status(200).json({ success: true, data: response });
  } catch (error: any) {
    logger.error('Error fetching form response by id', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  submitFormResponse,
  getFormResponses,
  getResponsesByEntity,
  getAllResponses,
  getFormResponseById,
};
