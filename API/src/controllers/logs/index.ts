import { Request, Response } from 'express';
import { Op } from 'sequelize';
import Log from '../../models/Log';

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
    
    // Calculate total pages
    const totalPages = Math.ceil(count / Number(limit));
    
    res.status(200).json({
      success: true,
      data: {
        logs,
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
