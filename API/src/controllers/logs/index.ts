import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Log from '../../models/Log';
import User from '../../models/User';

/**
 * Get all logs with optional filtering
 * @param req - Express request object
 * @param res - Express response object
 */
export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, method, resource, startDate, endDate, page = 1, limit = 50 } = req.query;
    
    // Build filter conditions
    const whereClause: any = {};
    
    // Filter by userId if provided
    if (userId) {
      whereClause.userId = userId;
    }
    
    // Filter by HTTP method if provided
    if (method) {
      whereClause.method = method;
    }
    
    // Filter by resource (URL path) if provided
    if (resource) {
      whereClause.url = {
        [Op.like]: `%/${resource as string}%`
      };
    }
    
    // Filter by date range if provided
    if (startDate || endDate) {
      whereClause.timestamp = {};
      
      if (startDate) {
        whereClause.timestamp[Op.gte] = new Date(startDate as string);
      }
      
      if (endDate) {
        whereClause.timestamp[Op.lte] = new Date(endDate as string);
      }
    }
    
    // Calculate pagination
    const offset = (Number(page) - 1) * Number(limit);
    
    // Get logs with pagination
    const { count, rows: logs } = await Log.findAndCountAll({
      where: whereClause,
      order: [['timestamp', 'DESC']],
      limit: Number(limit),
      offset
    });
    
    // Enrich logs with user display name and human-readable message
    const userIds = Array.from(new Set(logs.map((l: any) => l.userId).filter(Boolean)));
    const users = userIds.length > 0 ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'firstName', 'lastName', 'email'] }) : [];
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    const enriched = logs.map((l: any) => {
      const u = l.userId ? userMap.get(l.userId) : null;
      const displayName = u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u.id : 'Anonymous';
      const resourcePath = (l.url || '').split('?')[0];
      const message = `${displayName} ${l.method} ${resourcePath} → ${l.status}`;
      return {
        ...l.toJSON(),
        userDisplayName: displayName,
        resource: resourcePath,
        message,
      };
    });

    // Calculate total pages
    const totalPages = Math.ceil(count / Number(limit));
    
    res.status(200).json({
      success: true,
      data: {
        logs: enriched,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
};

export default {
  getLogs
};
