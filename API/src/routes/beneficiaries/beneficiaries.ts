import { Router, Request, Response } from 'express';
import beneficiariesController from '../../controllers/beneficiaries';
import { authenticate, authorize } from '../../middlewares/auth';
import loggerMiddleware from '../../middlewares/logger';
import { ROLES } from '../../constants/roles';

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * tags:
 *   name: Beneficiaries
 *   description: Manage beneficiaries (admin/manager only for write operations)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Beneficiary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         pseudonym:
 *           type: string
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /beneficiaries:
 *   get:
 *     summary: List beneficiaries
 *     tags: [Beneficiaries]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Paginated list of beneficiaries
 */
router.get(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.list(req, res);
  }
);

/**
 * @swagger
 * /beneficiaries/{id}:
 *   get:
 *     summary: Get a beneficiary by ID
 *     tags: [Beneficiaries]
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
 *         description: Beneficiary data
 *       404:
 *         description: Not found
 */
router.get(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.getById(req, res);
  }
);

/**
 * @swagger
 * /beneficiaries/{id}/pii:
 *   get:
 *     summary: Get decrypted PII for a beneficiary (restricted)
 *     description: Returns decrypted PII fields. Access is restricted and all reads are audited. Responses are marked no-store.
 *     tags: [Beneficiaries]
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
 *         description: Decrypted PII projection
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.get(
  '/:id/pii',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    beneficiariesController.getPIIById(req, res);
  }
);

/**
 * @swagger
 * /beneficiaries:
 *   post:
 *     summary: Create a beneficiary
 *     description: Admin/Manager only. PII is encrypted at rest. Response contains only safe fields.
 *     tags: [Beneficiaries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               dob: { type: string, format: date }
 *               nationalId: { type: string }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               address: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.create(req, res);
  }
);

/**
 * @swagger
 * /beneficiaries/{id}:
 *   put:
 *     summary: Update a beneficiary
 *     tags: [Beneficiaries]
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
 *               firstName: { type: string }
 *               lastName: { type: string }
 *               dob: { type: string, format: date }
 *               nationalId: { type: string }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               address: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.update(req, res);
  }
);

/**
 * @swagger
 * /beneficiaries/{id}/status:
 *   patch:
 *     summary: Update beneficiary status
 *     tags: [Beneficiaries]
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
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch(
  '/:id/status',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.setStatus(req, res);
  }
);

/**
 * @swagger
 * /beneficiaries/{id}:
 *   delete:
 *     summary: Deactivate a beneficiary
 *     description: Soft-delete by setting status to inactive
 *     tags: [Beneficiaries]
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
 *         description: Deactivated
 */
router.delete(
  '/:id',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.remove(req, res);
  }
);

export default router;
