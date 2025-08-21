import { Router, Request, Response } from 'express';
import permissionsController from '../../controllers/permissions';
import { authenticate, authorize } from '../../middlewares/auth';
import loggerMiddleware from '../../middlewares/logger';
import { ROLES } from '../../constants/roles';

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * tags:
 *   name: Permissions
 *   description: Manage permissions
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Permission:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         resource:
 *           type: string
 *         action:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /permissions:
 *   get:
 *     summary: List permissions
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated list of permissions
 */
router.get(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    permissionsController.list(req, res);
  }
);

/**
 * @swagger
 * /permissions/{id}:
 *   get:
 *     summary: Get a permission by ID
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Permission data
 *       404:
 *         description: Not found
 */
router.get(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    permissionsController.getById(req, res);
  }
);

/**
 * @swagger
 * /permissions:
 *   post:
 *     summary: Create a permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, resource, action]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               resource: { type: string }
 *               action: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    permissionsController.create(req, res);
  }
);

/**
 * @swagger
 * /permissions/{id}:
 *   put:
 *     summary: Update a permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               resource: { type: string }
 *               action: { type: string }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    permissionsController.update(req, res);
  }
);

/**
 * @swagger
 * /permissions/{id}:
 *   delete:
 *     summary: Delete a permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    permissionsController.remove(req, res);
  }
);

export default router;
