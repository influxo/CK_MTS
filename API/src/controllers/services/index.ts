import { Request, Response } from 'express';
import sequelize from '../../db/connection';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { createLogger } from '../../utils/logger';
import { AuditLog, Service, ServiceAssignment, ServiceDelivery } from '../../models';
import { Op, fn, col } from 'sequelize';

const logger = createLogger('services-controller');

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

// Build dynamic filters for ServiceDelivery queries from request query parameters
const buildDeliveryWhere = (q: any) => {
  const where: any = {};
  if (q.serviceId) where.serviceId = q.serviceId;
  if (q.serviceIds) {
    const ids = Array.isArray(q.serviceIds) ? q.serviceIds : String(q.serviceIds).split(',');
    where.serviceId = { [Op.in]: ids };
  }
  if (q.staffUserId) where.staffUserId = q.staffUserId;
  if (q.beneficiaryId) where.beneficiaryId = q.beneficiaryId;
  if (q.entityId) where.entityId = q.entityId;
  if (q.entityType) where.entityType = q.entityType;
  if (q.formResponseId) where.formResponseId = q.formResponseId;
  if (q.startDate || q.endDate) {
    where.deliveredAt = {};
    if (q.startDate) where.deliveredAt[Op.gte] = new Date(String(q.startDate));
    if (q.endDate) where.deliveredAt[Op.lte] = new Date(String(q.endDate));
  }
  return where;
};

// GET /services/metrics/deliveries/count
const metricsDeliveriesCount = async (req: Request, res: Response) => {
  try {
    const where = buildDeliveryWhere(req.query);
    const total = await ServiceDelivery.count({ where });
    return res.status(200).json({ success: true, data: { total } });
  } catch (error: any) {
    logger.error('Error computing deliveries count', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// GET /services/metrics/deliveries/by-user
const metricsDeliveriesByUser = async (req: Request, res: Response) => {
  try {
    const where = buildDeliveryWhere(req.query);
    const rows = await ServiceDelivery.findAll({
      attributes: ['staffUserId', [fn('COUNT', col('*')), 'count']],
      where,
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
    const where = buildDeliveryWhere(req.query);
    const rows = await ServiceDelivery.findAll({
      attributes: ['beneficiaryId', [fn('COUNT', col('*')), 'count']],
      where,
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
    const where = buildDeliveryWhere(req.query);
    const rows = await ServiceDelivery.findAll({
      attributes: ['serviceId', [fn('COUNT', col('*')), 'count']],
      where,
      group: ['serviceId'],
      order: [[fn('COUNT', col('*')), 'DESC']],
    });
    return res.status(200).json({ success: true, items: rows });
  } catch (error: any) {
    logger.error('Error computing deliveries by service', { error: error.message });
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
};
