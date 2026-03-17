import { Router, Request, Response } from 'express';
import rolesController from '../../controllers/roles';
import { authenticate, authorize } from '../../middlewares/auth';
import loggerMiddleware from '../../middlewares/logger';
import { ROLES } from '../../constants/roles';

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * tags:
 *   name: Roles
 *   description: Manage system roles and their permissions
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         permissions:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Permission'
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
 * /roles:
 *   get:
 *     summary: List roles with their permissions
 *     tags: [Roles]
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
 *     responses:
 *       200:
 *         description: Paginated list of roles
 */
router.get(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    rolesController.list(req, res);
  }
);

/**
 * @swagger
 * /roles/{id}:
 *   get:
 *     summary: Get a role by ID (includes permissions)
 *     tags: [Roles]
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
 *         description: Role data
 *       404:
 *         description: Not found
 */
router.get(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    rolesController.getById(req, res);
  }
);

/**
 * @swagger
 * /roles:
 *   post:
 *     summary: Create a role
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    rolesController.create(req, res);
  }
);

/**
 * @swagger
 * /roles/{id}:
 *   put:
 *     summary: Update a role
 *     tags: [Roles]
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
 *     responses:
 *       200:
 *         description: Updated
 */
router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    rolesController.update(req, res);
  }
);

/**
 * @swagger
 * /roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     tags: [Roles]
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
    rolesController.remove(req, res);
  }
);

/**
 * @swagger
 * /roles/{id}/permissions:
 *   get:
 *     summary: List permissions assigned to a role
 *     tags: [Roles]
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
 *         description: Permissions for the role
 */
router.get(
  '/:id/permissions',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    rolesController.getPermissions(req, res);
  }
);

/**
 * @swagger
 * /roles/{id}/permissions:
 *   put:
 *     summary: Replace the permissions assigned to a role
 *     description: Provide the full list of permissionIds desired for the role. The server will add missing ones and remove extras.
 *     tags: [Roles]
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
 *             required: [permissionIds]
 *             properties:
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Updated role with permissions
 */
router.put(
  '/:id/permissions',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    rolesController.setPermissions(req, res);
  }
);

export default router;
