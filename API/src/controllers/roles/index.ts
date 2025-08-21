import { Request, Response } from 'express';
import { Op, Transaction } from 'sequelize';
import sequelize from '../../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { AuditLog, Permission, Role, RolePermission, UserRole } from '../../models';

const logger = createLogger('roles-controller');

const list = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
    const search = (req.query.search as string) || '';

    const where: any = {};
    if (search) {
      where.name = { [Op.iLike]: `%${search}%` };
    }

    const { rows, count } = await Role.findAndCountAll({
      where,
      include: [{ association: 'permissions' }],
      order: [['name', 'ASC']],
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
    logger.error('Error listing roles', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const role = await Role.findByPk(id, { include: [{ association: 'permissions' }] });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    return res.status(200).json({ success: true, data: role });
  } catch (error: any) {
    logger.error('Error fetching role', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req: Request, res: Response) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

  try {
    const exists = await Role.findOne({ where: { name } });
    if (exists) return res.status(409).json({ success: false, message: 'Role with this name already exists' });

    const created = await sequelize.transaction(async (transaction: Transaction) => {
      const role = await Role.create({ id: uuidv4(), name, description }, { transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'ROLE_CREATE',
        description: `Created role '${name}'`,
        details: JSON.stringify({ roleId: role.id }),
        timestamp: new Date(),
      }, { transaction });

      return role;
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('Error creating role', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description } = req.body || {};

  try {
    const updated = await sequelize.transaction(async (transaction: Transaction) => {
      const role = await Role.findByPk(id, { transaction });
      if (!role) return null;

      if (name && name !== role.get('name')) {
        const exists = await Role.findOne({ where: { name }, transaction });
        if (exists) throw new Error('DUPLICATE_NAME');
      }

      await role.update({ name: name ?? role.get('name'), description: description ?? role.get('description') }, { transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'ROLE_UPDATE',
        description: `Updated role '${role.get('name')}'`,
        details: JSON.stringify({ roleId: role.get('id'), changedFields: Object.keys(req.body || {}) }),
        timestamp: new Date(),
      }, { transaction });

      return role;
    });

    if (!updated) return res.status(404).json({ success: false, message: 'Role not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === 'DUPLICATE_NAME') {
      return res.status(409).json({ success: false, message: 'Role with this name already exists' });
    }
    logger.error('Error updating role', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const removed = await sequelize.transaction(async (transaction: Transaction) => {
      const role = await Role.findByPk(id, { transaction });
      if (!role) return null;

      // Detach from users and permissions first
      await RolePermission.destroy({ where: { roleId: id }, transaction });
      await UserRole.destroy({ where: { roleId: id }, transaction });

      await role.destroy({ transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'ROLE_DELETE',
        description: `Deleted role '${role.get('name')}'`,
        details: JSON.stringify({ roleId: id }),
        timestamp: new Date(),
      }, { transaction });

      return role;
    });

    if (!removed) return res.status(404).json({ success: false, message: 'Role not found' });
    return res.status(200).json({ success: true, data: removed });
  } catch (error: any) {
    logger.error('Error deleting role', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getPermissions = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const role = await Role.findByPk(id, { include: [{ association: 'permissions' }] });
    if (!role) return res.status(404).json({ success: false, message: 'Role not found' });
    const permissions = (role as any).permissions || [];
    return res.status(200).json({ success: true, role: { id: role.get('id'), name: role.get('name') }, permissions });
  } catch (error: any) {
    logger.error('Error fetching role permissions', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const setPermissions = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { permissionIds } = req.body || {};
  if (!Array.isArray(permissionIds)) {
    return res.status(400).json({ success: false, message: 'permissionIds (array) is required' });
  }

  try {
    const updated = await sequelize.transaction(async (transaction: Transaction) => {
      const role = await Role.findByPk(id, { transaction });
      if (!role) return null;

      // Validate all permissions exist
      const perms = await Permission.findAll({ where: { id: { [Op.in]: permissionIds } }, transaction });
      if (perms.length !== permissionIds.length) {
        throw new Error('INVALID_PERMISSIONS');
      }

      // Existing assignments
      const current = await RolePermission.findAll({ where: { roleId: id }, transaction });
      const currentIds = new Set(current.map((rp: any) => rp.get('permissionId')));
      const desiredIds = new Set(permissionIds as string[]);

      // Determine to add and remove
      const toAdd = [...desiredIds].filter((pid) => !currentIds.has(pid));
      const toRemove = [...currentIds].filter((pid) => !desiredIds.has(pid));

      if (toRemove.length > 0) {
        await RolePermission.destroy({ where: { roleId: id, permissionId: { [Op.in]: toRemove } }, transaction });
      }
      if (toAdd.length > 0) {
        await RolePermission.bulkCreate(
          toAdd.map((pid) => ({ id: uuidv4(), roleId: id, permissionId: pid })),
          { transaction }
        );
      }

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'ROLE_SET_PERMISSIONS',
        description: `Set permissions for role '${role.get('name')}'`,
        details: JSON.stringify({ roleId: id, permissionIds }),
        timestamp: new Date(),
      }, { transaction });

      const refreshed = await Role.findByPk(id, { include: [{ association: 'permissions' }], transaction });
      return refreshed;
    });

    if (!updated) return res.status(404).json({ success: false, message: 'Role not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === 'INVALID_PERMISSIONS') {
      return res.status(400).json({ success: false, message: 'One or more permissionIds are invalid' });
    }
    logger.error('Error setting role permissions', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  list,
  getById,
  create,
  update,
  remove,
  getPermissions,
  setPermissions,
};
