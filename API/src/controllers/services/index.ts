import { Request, Response } from 'express';
import sequelize from '../../db/connection';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { createLogger } from '../../utils/logger';
import { AuditLog, Service, ServiceAssignment, ServiceDelivery, FormResponse, User, ProjectUser, SubprojectUser } from '../../models';
import { Op, fn, col } from 'sequelize';
import { ROLES } from '../../constants/roles';

const logger = createLogger('services-controller');

/**
 * Helper function to determine entity filtering based on user's role
 * Returns object with entityIds array and additional filtering info
 * 
 * Role-based filtering:
 * - SuperAdmin/System Administrator: null (no filtering - see all data)
 * - Program Manager: all associated projects
 * - Sub-Project Manager: all associated subprojects
 * - Field Operator: filter by staffUserId (not by entities)
 */
interface EntityFilterResult {
  entityIds: string[] | null;  // null means no entity filtering
  filterByStaffUser?: boolean;  // true for Field Operators
  staffUserId?: string;
}

const getUserEntityFilter = async (userId: string): Promise<EntityFilterResult> => {
  try {
    // Load user with roles
    const userWithRoles = await User.findByPk(userId, {
      include: [{ association: 'roles' }]
    });

    if (!userWithRoles) {
      return { entityIds: [] };  // User not found - no access
    }

    const userRoles = (userWithRoles as any).roles || [];
    const roleNames = userRoles.map((role: any) => role.name);

    // SuperAdmin & System Administrator: See all data
    if (roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR)) {
      return { entityIds: null };  // No filtering
    }

    // Field Operator: Only see their own submissions
    if (roleNames.includes(ROLES.FIELD_OPERATOR)) {
      return {
        entityIds: null,  // Don't filter by entity
        filterByStaffUser: true,
        staffUserId: userId
      };
    }

    // Program Manager: See their assigned projects
    if (roleNames.includes(ROLES.PROGRAM_MANAGER)) {
      const projectUsers = await ProjectUser.findAll({
        where: { userId },
        attributes: ['projectId']
      });
      const projectIds = projectUsers.map(pu => pu.get('projectId') as string);
      return { entityIds: projectIds };
    }

    // Sub-Project Manager: See their assigned subprojects
    if (roleNames.includes(ROLES.SUB_PROJECT_MANAGER)) {
      const subprojectUsers = await SubprojectUser.findAll({
        where: { userId },
        attributes: ['subprojectId']
      });
      const subprojectIds = subprojectUsers.map(su => su.get('subprojectId') as string);
      return { entityIds: subprojectIds };
    }

    // Default: No access
    return { entityIds: [] };
  } catch (error: any) {
    logger.error('Error determining user entity filter', { userId, error: error.message });
    return { entityIds: [] };
  }
};

const list = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const status = req.query.status as 'active' | 'inactive' | undefined;
    const where: any = {};
    if (status) where.status = status;

    const offset = (page - 1) * limit;
    const { rows, count } = await Service.findAndCountAll({ where, limit, offset, order: [['createdAt', 'DESC']] });

    return res.status(200).json({ success: true, items: rows, page, limit, totalItems: count, totalPages: Math.ceil(count / limit) });
  } catch (error: any) {
    logger.error('Error listing services', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Build dynamic filters for ServiceDelivery queries from request query parameters
 * Applies automatic role-based filtering unless explicitly overridden
 */
const buildDeliveryWhere = async (q: any, userId?: string) => {
  const where: any = {};

  // Service filtering (single or multiple)
  if (q.serviceId) where.serviceId = q.serviceId;
  if (q.serviceIds) {
    const ids = Array.isArray(q.serviceIds) ? q.serviceIds : String(q.serviceIds).split(',');
    where.serviceId = { [Op.in]: ids };
  }

  // Beneficiary filtering
  if (q.beneficiaryId) where.beneficiaryId = q.beneficiaryId;

  // Form response filtering
  if (q.formResponseId) where.formResponseId = q.formResponseId;

  // Date range filtering
  if (q.startDate || q.endDate) {
    where.deliveredAt = {};
    if (q.startDate) where.deliveredAt[Op.gte] = new Date(String(q.startDate));
    if (q.endDate) where.deliveredAt[Op.lte] = new Date(String(q.endDate));
  }

  // Apply automatic role-based filtering if userId provided
  if (userId) {
    const userFilter = await getUserEntityFilter(userId);

    // Handle Field Operator: filter by staffUserId (unless explicitly set)
    if (userFilter.filterByStaffUser && !q.staffUserId) {
      where.staffUserId = userFilter.staffUserId;
    }

    // Handle entity filtering
    // Priority 1: Explicit entityId/entityIds in query (manual override)
    if (q.entityId) {
      where.entityId = q.entityId;
    } else if (q.entityIds) {
      const ids = Array.isArray(q.entityIds) ? q.entityIds : String(q.entityIds).split(',');
      where.entityId = { [Op.in]: ids };
    } else if (userFilter.entityIds !== null) {
      // Priority 2: Apply role-based entity filtering
      if (userFilter.entityIds.length > 0) {
        where.entityId = { [Op.in]: userFilter.entityIds };
      } else {
        // User has no accessible entities - return no results
        where.entityId = { [Op.in]: [] };
      }
    }
    // If entityIds is null (admin/sysadmin), no entity filtering is applied
  }

  // Staff user filtering (explicit from query - overrides auto-filter)
  if (q.staffUserId) where.staffUserId = q.staffUserId;

  // Entity type filtering
  if (q.entityType) where.entityType = q.entityType;

  return where;
};

// Conditionally include FormResponse join when filtering by or grouping on form template
const buildFormTemplateInclude = (q: any, requireForGrouping: boolean = false) => {
  const hasTemplateFilter = !!q.formTemplateId || !!q.formTemplateIds;
  if (!hasTemplateFilter && !requireForGrouping) return [] as any[];

  const templateWhere: any = {};
  if (q.formTemplateId) templateWhere.formTemplateId = q.formTemplateId;
  if (q.formTemplateIds) {
    const tids = Array.isArray(q.formTemplateIds) ? q.formTemplateIds : String(q.formTemplateIds).split(',');
    templateWhere.formTemplateId = { [Op.in]: tids };
  }

  return [{ model: FormResponse, as: 'formResponse', attributes: [], where: Object.keys(templateWhere).length ? templateWhere : undefined }];
};

// GET /services/metrics/deliveries/count
const metricsDeliveriesCount = async (req: Request, res: Response) => {
  try {
    const where = await buildDeliveryWhere(req.query, req.user?.id);
    const include = buildFormTemplateInclude(req.query);
    const total = await ServiceDelivery.count({ where, include, distinct: true });
    return res.status(200).json({ success: true, data: { total } });
  } catch (error: any) {
    logger.error('Error computing deliveries count', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /services/metrics/deliveries/by-user
const metricsDeliveriesByUser = async (req: Request, res: Response) => {
  try {
    const where = await buildDeliveryWhere(req.query, req.user?.id);
    const include = buildFormTemplateInclude(req.query);
    const rows = await ServiceDelivery.findAll({
      where,
      include,
      attributes: ['staffUserId', [fn('COUNT', col('*')), 'count']],
      group: ['staffUserId'],
      order: [[fn('COUNT', col('*')), 'DESC']],
    });
    return res.status(200).json({ success: true, items: rows });
  } catch (error: any) {
    logger.error('Error computing deliveries by user', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /services/metrics/deliveries/by-beneficiary
const metricsDeliveriesByBeneficiary = async (req: Request, res: Response) => {
  try {
    const where = await buildDeliveryWhere(req.query, req.user?.id);
    const include = buildFormTemplateInclude(req.query);
    const rows = await ServiceDelivery.findAll({
      where,
      include,
      attributes: ['beneficiaryId', [fn('COUNT', col('*')), 'count']],
      group: ['beneficiaryId'],
      order: [[fn('COUNT', col('*')), 'DESC']],
    });
    return res.status(200).json({ success: true, items: rows });
  } catch (error: any) {
    logger.error('Error computing deliveries by beneficiary', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /services/metrics/deliveries/by-service
const metricsDeliveriesByService = async (req: Request, res: Response) => {
  try {
    const where = await buildDeliveryWhere(req.query, req.user?.id);
    const include = buildFormTemplateInclude(req.query);
    const rows = await ServiceDelivery.findAll({
      where,
      include,
      attributes: ['serviceId', [fn('COUNT', col('*')), 'count']],
      group: ['serviceId'],
      order: [[fn('COUNT', col('*')), 'DESC']],
    });
    return res.status(200).json({ success: true, items: rows });
  } catch (error: any) {
    logger.error('Error computing deliveries by service', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /services/metrics/deliveries/by-form-template
const metricsDeliveriesByFormTemplate = async (req: Request, res: Response) => {
  try {
    const where = await buildDeliveryWhere(req.query, req.user?.id);
    // Require include for grouping on formTemplate
    const include = buildFormTemplateInclude(req.query, true);
    const rows = await ServiceDelivery.findAll({
      where,
      include,
      attributes: [[col('formResponse.formTemplateId'), 'formTemplateId'], [fn('COUNT', col('*')), 'count']],
      group: [col('formResponse.formTemplateId') as any],
      order: [[fn('COUNT', col('*')), 'DESC']],
      raw: true,
    });
    return res.status(200).json({ success: true, items: rows });
  } catch (error: any) {
    logger.error('Error computing deliveries by form template', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /services/metrics/deliveries/series
const metricsDeliveriesSeries = async (req: Request, res: Response) => {
  try {
    const where = await buildDeliveryWhere(req.query, req.user?.id);
    const unitRaw = String((req.query.groupBy as string) || 'month').toLowerCase();
    const allowedUnits = new Set(['day', 'week', 'month', 'quarter', 'year']);
    const unit: 'day' | 'week' | 'month' | 'quarter' | 'year' = (allowedUnits.has(unitRaw) ? unitRaw : 'month') as any;

    // Optional secondary grouping (dimension)
    const groupFieldRaw = (req.query.groupField as string) || '';
    let groupColumn: 'serviceId' | 'staffUserId' | 'beneficiaryId' | 'formTemplateId' | null = null;
    if (groupFieldRaw === 'service') groupColumn = 'serviceId';
    else if (groupFieldRaw === 'user') groupColumn = 'staffUserId';
    else if (groupFieldRaw === 'beneficiary') groupColumn = 'beneficiaryId';
    else if (groupFieldRaw === 'formTemplate') groupColumn = 'formTemplateId';

    const bucketExpr = fn('date_trunc', unit, col('deliveredAt'));

    const attributes: any[] = [
      [bucketExpr, 'periodStart'],
      ...(groupColumn === 'formTemplateId' ? [[col('formResponse.formTemplateId'), 'formTemplateId']] : groupColumn ? [groupColumn] : []),
      [fn('COUNT', col('*')), 'count'],
    ];

    const group: any[] = groupColumn
      ? [bucketExpr, groupColumn === 'formTemplateId' ? (col('formResponse.formTemplateId') as any) : groupColumn]
      : [bucketExpr];

    // Include join when filtering by or grouping on formTemplate
    const include = buildFormTemplateInclude(req.query, groupColumn === 'formTemplateId');

    const rows = await ServiceDelivery.findAll({
      where,
      include,
      attributes,
      group,
      order: [[col('periodStart'), 'ASC']],
      raw: true,
    }) as any[];

    // Normalize periodStart to Date and counts to number
    const items = rows.map((r: any) => ({
      periodStart: new Date(r.periodStart),
      ...(groupColumn ? { [groupColumn!]: r[groupColumn!] } : {}),
      count: Number(r.count || 0),
    }));

    return res.status(200).json({ success: true, items, granularity: unit, groupedBy: groupColumn || null });
  } catch (error: any) {
    logger.error('Error computing deliveries time series', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /services/metrics/deliveries/summary
const metricsDeliveriesSummary = async (req: Request, res: Response) => {
  try {
    const where = await buildDeliveryWhere(req.query, req.user?.id);
    const include = buildFormTemplateInclude(req.query);
    const [totalDeliveries, uniqueBeneficiaries, uniqueStaff, uniqueServices] = await Promise.all([
      ServiceDelivery.count({ where, include, distinct: true }),
      ServiceDelivery.count({ where, include, distinct: true, col: 'beneficiaryId' as any }),
      ServiceDelivery.count({ where, include, distinct: true, col: 'staffUserId' as any }),
      ServiceDelivery.count({ where, include, distinct: true, col: 'serviceId' as any }),
    ]);

    return res.status(200).json({
      success: true,
      data: { totalDeliveries, uniqueBeneficiaries, uniqueStaff, uniqueServices },
    });
  } catch (error: any) {
    logger.error('Error computing deliveries summary', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const batchAssignToEntity = async (req: Request, res: Response) => {
  const { entityId, entityType, serviceIds, removeUnlisted } = req.body || {};
  if (!entityId || !entityType || !['project', 'subproject'].includes(entityType)) {
    return res.status(400).json({ success: false, message: "entityId and entityType (project|subproject) are required" });
  }
  if (!Array.isArray(serviceIds) || serviceIds.length === 0) {
    return res.status(400).json({ success: false, message: "serviceIds (non-empty array) is required" });
  }

  // Validate UUID formats to avoid DB cast errors
  const invalid: string[] = [];
  if (typeof entityId !== 'string' || !uuidValidate(entityId)) invalid.push(`entityId:${entityId}`);
  for (const sid of serviceIds) {
    if (typeof sid !== 'string' || !uuidValidate(sid)) invalid.push(`serviceId:${sid}`);
  }
  if (invalid.length > 0) {
    return res.status(400).json({ success: false, message: `Invalid UUIDs: ${invalid.join(', ')}` });
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      // Validate services exist
      const services = await Service.findAll({ where: { id: { [Op.in]: serviceIds } }, transaction });
      const foundIds = new Set(services.map((s) => s.get('id') as string));
      const missing = serviceIds.filter((sid: string) => !foundIds.has(sid));
      if (missing.length > 0) {
        return { status: 400 as const, error: `Unknown serviceIds: ${missing.join(', ')}` };
      }

      // Fetch existing assignments
      const existing = await ServiceAssignment.findAll({ where: { entityId, entityType }, transaction });
      const existingSet = new Set(existing.map((a) => a.get('serviceId') as string));

      // Assign all provided serviceIds (idempotent)
      const created: string[] = [];
      for (const sid of serviceIds) {
        if (!existingSet.has(sid)) {
          await ServiceAssignment.create({ id: uuidv4(), serviceId: sid, entityId, entityType }, { transaction });
          created.push(sid);
        }
      }

      // Optionally remove assignments not in list (replace semantics)
      let removed: number = 0;
      if (removeUnlisted === true) {
        const toRemove = existing.filter((a) => !serviceIds.includes(a.get('serviceId') as string));
        const toRemoveIds = toRemove.map((a) => a.get('id') as string);
        if (toRemoveIds.length > 0) {
          removed = await ServiceAssignment.destroy({ where: { id: { [Op.in]: toRemoveIds } }, transaction });
        }
      }

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'SERVICE_BATCH_ASSIGN',
        description: `Batch assigned ${serviceIds.length} services to ${entityType} ${entityId}${removeUnlisted ? ' (replace mode)' : ''}`,
        details: JSON.stringify({ entityId, entityType, provided: serviceIds.length, created, removed }),
        timestamp: new Date(),
      }, { transaction });

      // Return current assignments after operation
      const finalAssignments = await ServiceAssignment.findAll({ where: { entityId, entityType }, transaction });
      return { status: 200 as const, created, removed, assignments: finalAssignments };
    });

    if (result.status !== 200) return res.status(result.status).json({ success: false, message: result.error });
    return res.status(200).json({ success: true, data: { created: result.created, removed: result.removed, assignments: result.assignments } });
  } catch (error: any) {
    logger.error('Error batch assigning services', { entityId, entityType, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const s = await Service.findByPk(id);
    if (!s) return res.status(404).json({ success: false, message: 'Service not found' });
    return res.status(200).json({ success: true, data: s });
  } catch (error: any) {
    logger.error('Error fetching service', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req: Request, res: Response) => {
  const input = {
    name: req.body?.name,
    description: req.body?.description ?? null,
    category: req.body?.category ?? null,
    status: req.body?.status ?? 'active',
  } as any;

  if (!input.name) return res.status(400).json({ success: false, message: 'name is required' });

  try {
    const created = await sequelize.transaction(async (transaction) => {
      const s = await Service.create({ id: uuidv4(), ...input }, { transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'SERVICE_CREATE',
        description: `Created service '${s.name}'`,
        details: JSON.stringify({ serviceId: s.id }),
        timestamp: new Date(),
      }, { transaction });

      return s;
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('Error creating service', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const input = {
    name: req.body?.name,
    description: req.body?.description,
    category: req.body?.category,
    status: req.body?.status,
  } as any;

  try {
    const updated = await sequelize.transaction(async (transaction) => {
      const s = await Service.findByPk(id, { transaction });
      if (!s) return null;
      await s.update(input, { transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'SERVICE_UPDATE',
        description: `Updated service '${s.name}'`,
        details: JSON.stringify({ serviceId: s.id, changedFields: Object.keys(req.body || {}) }),
        timestamp: new Date(),
      }, { transaction });

      return s;
    });

    if (!updated) return res.status(404).json({ success: false, message: 'Service not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error updating service', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const setStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status || !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status. Must be 'active' or 'inactive'" });
  }

  try {
    const updated = await sequelize.transaction(async (transaction) => {
      const s = await Service.findByPk(id, { transaction });
      if (!s) return null;
      await s.update({ status }, { transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'SERVICE_STATUS_UPDATE',
        description: `Updated service status for '${s.name}' to ${status}`,
        details: JSON.stringify({ serviceId: s.id, status }),
        timestamp: new Date(),
      }, { transaction });

      return s;
    });

    if (!updated) return res.status(404).json({ success: false, message: 'Service not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error setting service status', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const assignToEntity = async (req: Request, res: Response) => {
  const { id } = req.params; // serviceId
  const { entityId, entityType } = req.body || {};
  if (!entityId || !entityType || !['project', 'subproject'].includes(entityType)) {
    return res.status(400).json({ success: false, message: "entityId and entityType (project|subproject) are required" });
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const s = await Service.findByPk(id, { transaction });
      if (!s) return { status: 404 as const };

      const [assignment] = await ServiceAssignment.findOrCreate({
        where: { serviceId: id, entityId, entityType },
        defaults: { id: uuidv4(), serviceId: id, entityId, entityType },
        transaction,
      });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'SERVICE_ASSIGN',
        description: `Assigned service '${s.name}' to ${entityType} ${entityId}`,
        details: JSON.stringify({ serviceId: id, entityId, entityType }),
        timestamp: new Date(),
      }, { transaction });

      return { status: 200 as const, assignment };
    });

    if (result.status === 404) return res.status(404).json({ success: false, message: 'Service not found' });
    return res.status(200).json({ success: true, data: result.assignment });
  } catch (error: any) {
    logger.error('Error assigning service', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const unassignFromEntity = async (req: Request, res: Response) => {
  const { id } = req.params; // serviceId
  const { entityId, entityType } = req.body || {};
  if (!entityId || !entityType || !['project', 'subproject'].includes(entityType)) {
    return res.status(400).json({ success: false, message: "entityId and entityType (project|subproject) are required" });
  }

  try {
    const result = await sequelize.transaction(async (transaction) => {
      const s = await Service.findByPk(id, { transaction });
      if (!s) return { status: 404 as const };

      const deleted = await ServiceAssignment.destroy({ where: { serviceId: id, entityId, entityType }, transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'SERVICE_UNASSIGN',
        description: `Unassigned service '${s.name}' from ${entityType} ${entityId}`,
        details: JSON.stringify({ serviceId: id, entityId, entityType, deleted }),
        timestamp: new Date(),
      }, { transaction });

      return { status: 200 as const, deleted };
    });

    if (result.status === 404) return res.status(404).json({ success: false, message: 'Service not found' });
    return res.status(200).json({ success: true, data: { deleted: result.deleted } });
  } catch (error: any) {
    logger.error('Error unassigning service', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const listAssignedForEntity = async (req: Request, res: Response) => {
  const { entityId, entityType } = req.query as any;
  if (!entityId || !entityType || !['project', 'subproject'].includes(entityType)) {
    return res.status(400).json({ success: false, message: "entityId and entityType (project|subproject) are required" });
  }

  try {
    const assignments = await ServiceAssignment.findAll({ where: { entityId, entityType } });
    const serviceIds = assignments.map((a) => a.get('serviceId') as string);
    const services = serviceIds.length > 0 ? await Service.findAll({ where: { id: { [Op.in]: serviceIds } } }) : [];
    return res.status(200).json({ success: true, items: services });
  } catch (error: any) {
    logger.error('Error listing assigned services', { entityId, entityType, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  list,
  getById,
  create,
  update,
  setStatus,
  assignToEntity,
  batchAssignToEntity,
  unassignFromEntity,
  listAssignedForEntity,
  metricsDeliveriesCount,
  metricsDeliveriesByUser,
  metricsDeliveriesByBeneficiary,
  metricsDeliveriesByService,
  metricsDeliveriesByFormTemplate,
  metricsDeliveriesSeries,
  metricsDeliveriesSummary,
};
