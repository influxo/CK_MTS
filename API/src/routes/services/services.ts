import { Router, Request, Response } from 'express';
import servicesController from '../../controllers/services';
import { authenticate, authorize } from '../../middlewares/auth';
import loggerMiddleware from '../../middlewares/logger';
import { ROLES } from '../../constants/roles';

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * tags:
 *   name: Services
 *   description: Manage centrally defined services and assignments
 */

/**
 * @swagger
 * /services:
 *   get:
 *     summary: List services
 *     tags: [Services]
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
 *         description: Paginated list of services
 */
router.get(
  '/',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.list(req, res);
  }
);
router.get(
  '/assigned',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.listAssignedForEntity(req, res);
  }
);

/**
 * @swagger
 * /services/{id}:
 *   get:
 *     summary: Get a service by ID
 *     tags: [Services]
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
 *         description: Service data
 *       404:
 *         description: Not found
 */
router.get(
  '/:id',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.getById(req, res);
  }
);

/**
 * @swagger
 * /services:
 *   post:
 *     summary: Create a service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       201:
 *         description: Created
 */
router.post(
  '/',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.create(req, res);
  }
);

/**
 * @swagger
 * /services/{id}:
 *   put:
 *     summary: Update a service
 *     tags: [Services]
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
 *               category: { type: string }
 *               status: { type: string, enum: [active, inactive] }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put(
  '/:id',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.update(req, res);
  }
);

/**
 * @swagger
 * /services/{id}/status:
 *   patch:
 *     summary: Update service status
 *     tags: [Services]
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
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.setStatus(req, res);
  }
);

/**
 * @swagger
 * /services/{id}/assign:
 *   post:
 *     summary: Assign a service to an entity (project or subproject)
 *     tags: [Services]
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
 *               entityId: { type: string }
 *               entityType: { type: string, enum: [project, subproject] }
 *     responses:
 *       200:
 *         description: Assigned
 */
router.post(
  '/:id/assign',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.assignToEntity(req, res);
  }
);

/**
 * @swagger
 * /services/{id}/unassign:
 *   post:
 *     summary: Unassign a service from an entity
 *     tags: [Services]
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
 *               entityId: { type: string }
 *               entityType: { type: string, enum: [project, subproject] }
 *     responses:
 *       200:
 *         description: Unassigned
 */
router.post(
  '/:id/unassign',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.unassignFromEntity(req, res);
  }
);

/**
 * @swagger
 * /services/assignments/batch:
 *   post:
 *     summary: Batch assign services to an entity
 *     description: Assign multiple services to a project or subproject in a single request. Optionally remove assignments not listed.
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityId, entityType, serviceIds]
 *             properties:
 *               entityId:
 *                 type: string
 *                 format: uuid
 *               entityType:
 *                 type: string
 *                 enum: [project, subproject]
 *               serviceIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *               removeUnlisted:
 *                 type: boolean
 *                 default: false
 *                 description: If true, unassign any services currently assigned to the entity that are not in serviceIds
 *     responses:
 *       200:
 *         description: Batch assignment completed
 *       400:
 *         description: Invalid input
 */
router.post(
  '/assignments/batch',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.batchAssignToEntity(req, res);
  }
);

/**
 * @swagger
 * /services/metrics/deliveries/count:
 *   get:
 *     summary: Total count of service deliveries
 *     description: |
 *       Returns total count of service deliveries with automatic role-based filtering.
 *       
 *       **Automatic Role-Based Filtering:**
 *       - **SuperAdmin & System Administrator**: See all data
 *       - **Program Manager**: See only their assigned projects
 *       - **Sub-Project Manager**: See only their assigned subprojects
 *       - **Field Operator**: See only their own submissions (filtered by staffUserId)
 *       - **Override**: Use entityId/entityIds parameters to explicitly filter
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: staffUserId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, enum: [project, subproject, activity] }
 *       - in: query
 *         name: formResponseId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Total count
 */
router.get(
  '/metrics/deliveries/count',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.metricsDeliveriesCount(req, res);
  }
);

/**
 * @swagger
 * /services/metrics/deliveries/by-user:
 *   get:
 *     summary: Count of service deliveries grouped by staff user
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string }
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, enum: [project, subproject, activity] }
 *       - in: query
 *         name: formResponseId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Aggregation list
 */
router.get(
  '/metrics/deliveries/by-user',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.metricsDeliveriesByUser(req, res);
  }
);

/**
 * @swagger
 * /services/metrics/deliveries/by-beneficiary:
 *   get:
 *     summary: Count of service deliveries grouped by beneficiary
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string }
 *       - in: query
 *         name: staffUserId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, enum: [project, subproject, activity] }
 *       - in: query
 *         name: formResponseId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Aggregation list
 */
router.get(
  '/metrics/deliveries/by-beneficiary',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.metricsDeliveriesByBeneficiary(req, res);
  }
);

/**
 * @swagger
 * /services/metrics/deliveries/by-service:
 *   get:
 *     summary: Count of service deliveries grouped by service
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: staffUserId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, enum: [project, subproject, activity] }
 *       - in: query
 *         name: formResponseId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Aggregation list
 */
router.get(
  '/metrics/deliveries/by-service',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.metricsDeliveriesByService(req, res);
  }
);

/**
 * @swagger
 * /services/metrics/deliveries/by-form-template:
 *   get:
 *     summary: Count of service deliveries grouped by form template
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string }
 *       - in: query
 *         name: staffUserId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, enum: [project, subproject, activity] }
 *       - in: query
 *         name: formResponseId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Aggregation list
 */
router.get(
  '/metrics/deliveries/by-form-template',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.metricsDeliveriesByFormTemplate(req, res);
  }
);

/**
 * @swagger
 * /services/metrics/deliveries/series:
 *   get:
 *     summary: Time series of service deliveries, optionally grouped by a dimension
 *     description: |
 *       Returns service delivery metrics over time with automatic role-based filtering.
 *       
 *       **Automatic Role-Based Filtering:**
 *       - **SuperAdmin & System Administrator**: See all data
 *       - **Program Manager**: See only their assigned projects
 *       - **Sub-Project Manager**: See only their assigned subprojects
 *       - **Field Operator**: See only their own submissions (filtered by staffUserId)
 *       - **Override**: Use entityId/entityIds parameters to explicitly filter
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month, quarter, year] }
 *         description: Time bucket granularity
 *       - in: query
 *         name: groupField
 *         schema: { type: string, enum: [service, user, beneficiary, formTemplate] }
 *         description: Optional secondary grouping dimension
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: staffUserId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, enum: [project, subproject, activity] }
 *       - in: query
 *         name: formResponseId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: List of time buckets with counts
 */
router.get(
  '/metrics/deliveries/series',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.metricsDeliveriesSeries(req, res);
  }
);

/**
 * @swagger
 * /services/metrics/deliveries/summary:
 *   get:
 *     summary: Summary of service deliveries (totals and uniques)
 *     description: |
 *       Returns summary statistics for service deliveries with automatic role-based filtering.
 *       
 *       **Automatic Role-Based Filtering:**
 *       - **SuperAdmin & System Administrator**: See all data
 *       - **Program Manager**: See only their assigned projects
 *       - **Sub-Project Manager**: See only their assigned subprojects
 *       - **Field Operator**: See only their own submissions (filtered by staffUserId)
 *       - **Override**: Use entityId/entityIds parameters to explicitly filter
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: staffUserId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, enum: [project, subproject, activity] }
 *       - in: query
 *         name: formResponseId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string, description: Comma-separated UUIDs }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Summary numbers
 */
router.get(
  '/metrics/deliveries/summary',
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.SUB_PROJECT_MANAGER]),
  (req: Request, res: Response): void => {
    servicesController.metricsDeliveriesSummary(req, res);
  }
);

/**
 * @swagger
 * /services/assigned:
 *   get:
 *     summary: List services assigned to an entity
 *     tags: [Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [project, subproject]
 *     responses:
 *       200:
 *         description: List of services assigned to the entity
 */


export default router;
