import { Router, Request, Response } from 'express';
import logsController from '../controllers/logs';
import { authenticate, authorize } from '../middlewares/auth';
import loggerMiddleware from '../middlewares/logger';
import { ROLES } from '../constants/roles';

const router = Router();

// Apply logger middleware to all routes in this router
router.use(loggerMiddleware);

/**
 * @swagger
 * /logs:
 *   get:
 *     summary: Get system logs with filtering options
 *     description: Retrieve system logs with optional filtering by user ID, HTTP method, and date range. Only accessible by System Administrators and SuperAdmins.
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter logs by user ID
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *           enum: [GET, POST, PUT, DELETE, PATCH]
 *         description: Filter logs by HTTP method
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *         description: Filter logs by resource path (e.g., 'users', 'auth', 'projects')
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter logs from this date (inclusive)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter logs until this date (inclusive)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of logs per page
 *     responses:
 *       200:
 *         description: List of logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                           method:
 *                             type: string
 *                           url:
 *                             type: string
 *                           status:
 *                             type: integer
 *                           responseTime:
 *                             type: integer
 *                           ip:
 *                             type: string
 *                           userAgent:
 *                             type: string
 *                           userId:
 *                             type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', 
  authenticate, 
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]), 
  (req: Request, res: Response): void => {
    logsController.getLogs(req, res);
  }
);

export default router;
