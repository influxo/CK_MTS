import { Request, Response } from 'express';
import { Op } from 'sequelize';
import AuditLog from '../../models/AuditLog';
import FormResponse from '../../models/FormResponse';

/**
 * GET /dashboard/activity-summary
 * Returns counts for recent activity: total form submissions and total project/subproject changes.
 * Query params: startDate, endDate (ISO date strings, optional)
 */
export const getActivitySummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    const dateWhere: any = {};
    if (startDate || endDate) {
      dateWhere[Op.and] = [] as any[];
      if (startDate) {
        dateWhere[Op.and].push({ timestamp: { [Op.gte]: new Date(startDate) } });
      }
      if (endDate) {
        dateWhere[Op.and].push({ timestamp: { [Op.lte]: new Date(endDate) } });
      }
    }

    // Form submissions come from FormResponse.createdAt
    const frWhere: any = {};
    if (startDate || endDate) {
      frWhere.createdAt = {};
      if (startDate) frWhere.createdAt[Op.gte] = new Date(startDate);
      if (endDate) frWhere.createdAt[Op.lte] = new Date(endDate);
    }

    const [formSubmissionsCount, projectChangesCount] = await Promise.all([
      FormResponse.count({ where: frWhere }),
      AuditLog.count({
        where: {
          ...(dateWhere[Op.and]?.length ? { [Op.and]: dateWhere[Op.and] } : {}),
          action: {
            [Op.in]: [
              'PROJECT_CREATED', 'PROJECT_UPDATED', 'PROJECT_DELETED',
              'SUBPROJECT_CREATED', 'SUBPROJECT_UPDATED', 'SUBPROJECT_DELETED',
            ],
          },
        },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        formSubmissionsCount,
        projectSubprojectChangesCount: projectChangesCount,
        range: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching activity summary:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default { getActivitySummary };
