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
 * /beneficiaries/by-entity:
 *   get:
 *     summary: List beneficiaries associated to an entity (project or subproject)
 *     tags: [Beneficiaries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [project, subproject]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated list of beneficiaries associated to the entity
 */
router.get(
  '/by-entity',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.listByEntity(req, res);
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Beneficiary'
 *                     - type: object
 *                       properties:
 *                         details:
 *                           type: object
 *                           additionalProperties: true
 *                           description: Optional extended details JSON if present
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
 * /beneficiaries/{id}/services:
 *   get:
 *     summary: List services delivered to a beneficiary
 *     description: Returns paginated service deliveries with service info and the entity (project/subproject/activity) where delivered.
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
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Paginated list of service deliveries
 *       404:
 *         description: Beneficiary not found
 */
router.get(
  '/:id/services',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.servicesForBeneficiary(req, res);
  }
);

/**
 * @swagger
 * /beneficiaries/{id}/services/history:
 *   get:
 *     summary: Chronological service history for a beneficiary
 *     description: Returns paginated service deliveries ordered by deliveredAt ASC with service, staff, and entity details.
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
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Paginated service history
 *       404:
 *         description: Beneficiary not found
 */
router.get(
  '/:id/services/history',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.serviceHistoryForBeneficiary(req, res);
  }
);

/**
 * @swagger
 * /beneficiaries/{id}/entities:
 *   get:
 *     summary: List entities where the beneficiary has received services
 *     description: Returns distinct entities (project/subproject/activity) with counts and last delivery date.
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
 *         description: List of entities with counts
 *       404:
 *         description: Beneficiary not found
 */
router.get(
  '/:id/entities',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.entitiesForBeneficiary(req, res);
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
 *               gender: { type: string, enum: [M, F] }
 *               municipality: { type: string }
 *               nationality: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *               details:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Optional extended details JSON to store under beneficiary_details
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
 *               gender: { type: string, enum: [M, F] }
 *               municipality: { type: string }
 *               nationality: { type: string }
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


/**
 * @swagger
 * /beneficiaries/demographics:
 *   get:
 *     summary: Aggregate beneficiary demographics (age buckets and gender)
 *     description: Decrypts PII to compute aggregates. Strictly restricted. Response is marked no-store.
 *     tags: [Beneficiaries]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Demographics aggregates
 *       403:
 *         description: Forbidden
 */
router.get(
  '/demographics',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    beneficiariesController.demographics(req, res);
  }
);

/**
 * @swagger
 * /beneficiaries/{id}/entities:
 *   post:
 *     summary: Associate a beneficiary with an entity (project or subproject)
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
 *             required: [entityId, entityType]
 *             properties:
 *               entityId: { type: string, format: uuid }
 *               entityType: { type: string, enum: [project, subproject] }
 *     responses:
 *       200:
 *         description: Association created or already existed
 */
router.post(
  '/:id/entities',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.associateWithEntity(req, res);
  }
);

/**
 * @swagger
 * /beneficiaries/{id}/entities:
 *   delete:
 *     summary: Remove association between a beneficiary and an entity
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
 *             required: [entityId, entityType]
 *             properties:
 *               entityId: { type: string, format: uuid }
 *               entityType: { type: string, enum: [project, subproject] }
 *     responses:
 *       200:
 *         description: Association removed
 */
router.delete(
  '/:id/entities',
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    beneficiariesController.dissociateFromEntity(req, res);
  }
);

export default router;
