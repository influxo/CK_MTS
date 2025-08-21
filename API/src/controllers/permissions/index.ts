import { Request, Response } from 'express';
import { Op, Transaction } from 'sequelize';
import sequelize from '../../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { AuditLog, Permission } from '../../models';
import { RESOURCES, ACTIONS } from '../../constants/roles';

const logger = createLogger('permissions-controller');

const list = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const search = (req.query.search as string) || '';
    const resource = (req.query.resource as string) || '';
    const action = (req.query.action as string) || '';

    const where: any = {};
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }
    if (resource) {
      where.resource = { [Op.iLike]: `%${resource}%` };
    }
    if (action) {
      where.action = { [Op.iLike]: `%${action}%` };
    }

    const { rows, count } = await Permission.findAndCountAll({
      where,
      order: [['resource', 'ASC'], ['action', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });

    return res.status(200).json({
      success: true,
      items: rows,
      page,
      limit,
      totalItems: count,
      totalPages: Math.ceil(count / limit) || 1,
    });
  } catch (error: any) {
    logger.error('Error listing permissions', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const permission = await Permission.findByPk(id);
    if (!permission) return res.status(404).json({ success: false, message: 'Permission not found' });
    return res.status(200).json({ success: true, data: permission });
  } catch (error: any) {
    logger.error('Error fetching permission', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req: Request, res: Response) => {
  const { name, description, resource, action } = req.body || {};
  if (!name || !resource || !action) {
    return res.status(400).json({ success: false, message: 'name, resource and action are required' });
  }

  // Optional: validate against constants
  const allowedResources = Object.values(RESOURCES || {});
  const allowedActions = Object.values(ACTIONS || {});
  if (allowedResources.length && !allowedResources.includes(resource)) {
    return res.status(400).json({ success: false, message: 'Invalid resource' });
  }
  if (allowedActions.length && !allowedActions.includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action' });
  }

  try {
    const exists = await Permission.findOne({ where: { name } });
    if (exists) return res.status(409).json({ success: false, message: 'Permission with this name already exists' });

    const created = await sequelize.transaction(async (transaction: Transaction) => {
      const perm = await Permission.create({ id: uuidv4(), name, description, resource, action }, { transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'PERMISSION_CREATE',
        description: `Created permission '${name}'`,
        details: JSON.stringify({ permissionId: perm.id }),
        timestamp: new Date(),
      }, { transaction });

      return perm;
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('Error creating permission', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, resource, action } = req.body || {};

  // Optional: validate against constants when provided
  const allowedResources = Object.values(RESOURCES || {});
  const allowedActions = Object.values(ACTIONS || {});
  if (resource && allowedResources.length && !allowedResources.includes(resource)) {
    return res.status(400).json({ success: false, message: 'Invalid resource' });
  }
  if (action && allowedActions.length && !allowedActions.includes(action)) {
    return res.status(400).json({ success: false, message: 'Invalid action' });
  }

  try {
    const updated = await sequelize.transaction(async (transaction: Transaction) => {
      const perm = await Permission.findByPk(id, { transaction });
      if (!perm) return null;

      if (name && name !== perm.get('name')) {
        const exists = await Permission.findOne({ where: { name }, transaction });
        if (exists) throw new Error('DUPLICATE_NAME');
      }

      await perm.update({
        name: name ?? perm.get('name'),
        description: description ?? perm.get('description'),
        resource: resource ?? perm.get('resource'),
        action: action ?? perm.get('action'),
      }, { transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'PERMISSION_UPDATE',
        description: `Updated permission '${perm.get('name')}'`,
        details: JSON.stringify({ permissionId: perm.get('id'), changedFields: Object.keys(req.body || {}) }),
        timestamp: new Date(),
      }, { transaction });

      return perm;
    });

    if (!updated) return res.status(404).json({ success: false, message: 'Permission not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === 'DUPLICATE_NAME') {
      return res.status(409).json({ success: false, message: 'Permission with this name already exists' });
    }
    logger.error('Error updating permission', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const removed = await sequelize.transaction(async (transaction: Transaction) => {
      const perm = await Permission.findByPk(id, { transaction });
      if (!perm) return null;

      await perm.destroy({ transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'PERMISSION_DELETE',
        description: `Deleted permission '${perm.get('name')}'`,
        details: JSON.stringify({ permissionId: id }),
        timestamp: new Date(),
      }, { transaction });

      return perm;
    });

    if (!removed) return res.status(404).json({ success: false, message: 'Permission not found' });
    return res.status(200).json({ success: true, data: removed });
  } catch (error: any) {
    logger.error('Error deleting permission', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  list,
  getById,
  create,
  update,
  remove,
};
