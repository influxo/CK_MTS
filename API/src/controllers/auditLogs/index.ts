import { Request, Response } from 'express';
import { Op } from 'sequelize';
import AuditLog from '../../models/AuditLog';
import User from '../../models/User';

/**
 * GET /audit-logs
 * Return human-readable audit logs with user display names and pagination
 */
export const listAuditLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, action, startDate, endDate, page = 1, limit = 50 } = req.query;

    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp[Op.gte] = new Date(startDate as string);
      if (endDate) where.timestamp[Op.lte] = new Date(endDate as string);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['timestamp', 'DESC']],
      limit: Number(limit),
      offset,
    });

    const userIds = Array.from(new Set(rows.map((r: any) => r.userId).filter(Boolean)));
    const users = userIds.length ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'firstName', 'lastName', 'email'] }) : [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    const items = rows.map((r: any) => {
      const u = r.userId ? userMap.get(r.userId) : null;
      const userDisplayName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id : 'System';
      return {
        ...r.toJSON(),
        userDisplayName,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        items,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(count / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default { listAuditLogs };
