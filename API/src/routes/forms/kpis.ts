import { Router, Request, Response } from "express";
import formsController from "../../controllers/forms";
import { authenticate, authorize } from "../../middlewares/auth";
import { ROLES } from "../../constants/roles";
import loggerMiddleware from "../../middlewares/logger";

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * /forms/kpis:
 *   post:
 *     summary: Create a new KPI definition
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - calculationType
 *               - fieldId
 *               - aggregationType
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the KPI
 *               description:
 *                 type: string
 *                 description: Description of the KPI
 *               calculationType:
 *                 type: string
 *                 enum: [COUNT, SUM, AVERAGE, MIN, MAX, PERCENTAGE, CUSTOM]
 *                 description: Type of calculation to perform
 *               fieldId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the form field to calculate on
 *               aggregationType:
 *                 type: string
 *                 enum: [DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, ALL_TIME]
 *                 description: Time period for aggregating data
 *               filterCriteria:
 *                 type: object
 *                 description: Optional criteria for filtering form responses
 *     responses:
 *       201:
 *         description: KPI created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Un// authorized
 *       403:
 *         description: Forbidden - user does not have required permissions
 */
router.post(
  "/kpis",
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    formsController.kpis.createKpi(req, res);
  }
);

/**
 * @swagger
 * /forms/kpis/{id}:
 *   put:
 *     summary: Update an existing KPI definition
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the KPI to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the KPI
 *               description:
 *                 type: string
 *                 description: Description of the KPI
 *               calculationType:
 *                 type: string
 *                 enum: [COUNT, SUM, AVERAGE, MIN, MAX, PERCENTAGE, CUSTOM]
 *                 description: Type of calculation to perform
 *               fieldId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the form field to calculate on
 *               aggregationType:
 *                 type: string
 *                 enum: [DAILY, WEEKLY, MONTHLY, QUARTERLY, YEARLY, ALL_TIME]
 *                 description: Time period for aggregating data
 *               filterCriteria:
 *                 type: object
 *                 description: Optional criteria for filtering form responses
 *               isActive:
 *                 type: boolean
 *                 description: Whether the KPI is active or not
 *     responses:
 *       200:
 *         description: KPI updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Un// authorized
 *       403:
 *         description: Forbidden - user does not have required permissions
 *       404:
 *         description: KPI not found
 */
router.put(
  "/kpis/:id",
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    formsController.kpis.updateKpi(req, res);
  }
);

/**
 * @swagger
 * /forms/kpis/{id}:
 *   delete:
 *     summary: Delete a KPI definition
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the KPI to delete
 *     responses:
 *       200:
 *         description: KPI deleted successfully
 *       401:
 *         description: Un// authorized
 *       403:
 *         description: Forbidden - user does not have required permissions
 *       404:
 *         description: KPI not found
 */
router.delete(
  "/kpis/:id",
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    formsController.kpis.deleteKpi(req, res);
  }
);

/**
 * @swagger
 * /forms/kpis:
 *   get:
 *     summary: Get all KPI definitions
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all KPI definitions
 *       401:
 *         description: Un// authorized
 */
router.get(
  "/kpis",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.kpis.getAllKpis(req, res);
  }
);

/**
 * @swagger
 * /forms/kpis/{id}:
 *   get:
 *     summary: Get a KPI definition by ID
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the KPI to retrieve
 *     responses:
 *       200:
 *         description: KPI details
 *       401:
 *         description: Un// authorized
 *       404:
 *         description: KPI not found
 */
router.get(
  "/kpis/:id",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.kpis.getKpiById(req, res);
  }
);

/**
 * @swagger
 * /forms/kpis/{id}/calculate:
 *   get:
 *     summary: Calculate a specific KPI
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the KPI to calculate
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: Start date for data calculation
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: End date for data calculation
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: ID of the entity to filter by
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [project, subproject, activity]
 *         required: false
 *         description: Type of entity to filter by
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: ID of the project to filter by
 *       - in: query
 *         name: subprojectId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: ID of the subproject to filter by
 *       - in: query
 *         name: activityId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: ID of the activity to filter by
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *         required: false
 *         description: Filter by beneficiaryId present on form responses
 *       - in: query
 *         name: beneficiaryIds
 *         schema: { type: string }
 *         required: false
 *         description: Comma-separated beneficiary IDs
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *         required: false
 *         description: Filter by service via ServiceDeliveries linked to form responses
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string }
 *         required: false
 *         description: Comma-separated service IDs
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *         required: false
 *         description: Filter by formTemplateId
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string }
 *         required: false
 *         description: Comma-separated form template IDs
 *     responses:
 *       200:
 *         description: KPI calculation result
 *       401:
 *         description: Un// authorized
 *       404:
 *         description: KPI not found
 */
router.get(
  "/kpis/:id/calculate",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.kpis.calculateKpi(req, res);
  }
);

/**
 * @swagger
 * /forms/kpis/{id}/series:
 *   get:
 *     summary: Calculate a KPI time series for charting
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the KPI to calculate
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *         required: true
 *         description: Time bucketing unit
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: Start date for data calculation
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: End date for data calculation
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: ID of the entity to filter by
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [project, subproject, activity]
 *         required: false
 *         description: Type of entity to filter by
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: ID of the project to filter by
 *       - in: query
 *         name: subprojectId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: ID of the subproject to filter by
 *       - in: query
 *         name: activityId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: false
 *         description: ID of the activity to filter by
 *       - in: query
 *         name: dataFilters
 *         schema:
 *           type: string
 *         required: false
 *         description: JSON array string of ad-hoc filters, e.g. [{"field":"ginia","op":"eq","value":"M"}]
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *         required: false
 *         description: Filter by beneficiaryId present on form responses
 *       - in: query
 *         name: beneficiaryIds
 *         schema: { type: string }
 *         required: false
 *         description: Comma-separated beneficiary IDs
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *         required: false
 *         description: Filter by service via ServiceDeliveries linked to form responses
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string }
 *         required: false
 *         description: Comma-separated service IDs
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *         required: false
 *         description: Filter by formTemplateId
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string }
 *         required: false
 *         description: Comma-separated form template IDs
 *     responses:
 *       200:
 *         description: KPI time series result
 *       401:
 *         description: Un// authorized
 *       404:
 *         description: KPI not found
 */
router.get(
  "/kpis/:id/series",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.kpis.calculateKpiSeries(req, res);
  }
);

/**
 * @swagger
 * /forms/entities/{entityType}/{entityId}/kpis:
 *   get:
 *     summary: Calculate all KPIs for a specific entity
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [project, subproject, activity]
 *         required: true
 *         description: Type of entity
 *       - in: path
 *         name: entityId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the entity
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: Start date for data calculation
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date-time
 *         required: false
 *         description: End date for data calculation
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *         required: false
 *         description: Filter by beneficiaryId present on form responses
 *       - in: query
 *         name: beneficiaryIds
 *         schema: { type: string }
 *         required: false
 *         description: Comma-separated beneficiary IDs
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *         required: false
 *         description: Filter by service via ServiceDeliveries linked to form responses
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string }
 *         required: false
 *         description: Comma-separated service IDs
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *         required: false
 *         description: Filter by formTemplateId
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string }
 *         required: false
 *         description: Comma-separated form template IDs
 *     responses:
 *       200:
 *         description: Results of all KPI calculations for the entity
 *       400:
 *         description: Invalid entity type
 *       401:
 *         description: Un// authorized
 */
router.get(
  "/entities/:entityType/:entityId/kpis",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.kpis.calculateAllKpisForEntity(req, res);
  }
);

/**
 * @swagger
 * /forms/fields:
 *   get:
 *     summary: Get all available form fields for KPIs
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all form fields available for KPI calculations
 *       401:
 *         description: Un// authorized
 */
router.get(
  "/fields",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.kpis.getFormFields(req, res);
  }
);

/**
 * @swagger
 * /forms/metrics/summary:
 *   get:
 *     summary: Dynamic metrics summary from responses and service deliveries (no KPI definitions required)
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date-time }
 *         required: false
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date-time }
 *         required: false
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, enum: [project, subproject, activity] }
 *       - in: query
 *         name: projectId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: subprojectId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: activityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: beneficiaryIds
 *         schema: { type: string }
 *         description: Comma-separated beneficiary IDs
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string }
 *         description: Comma-separated service IDs
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string }
 *         description: Comma-separated form template IDs
 *     responses:
 *       200:
 *         description: Summary including submissions, unique beneficiaries, service deliveries, etc.
 */
router.get(
  "/metrics/summary",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.kpis.getMetricsSummary(req, res);
  }
);

/**
 * @swagger
 * /forms/metrics/series:
 *   get:
 *     summary: Dynamic metrics time series (submissions, serviceDeliveries, uniqueBeneficiaries)
 *     tags: [Forms, KPIs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: metric
 *         schema: { type: string, enum: [submissions, serviceDeliveries, uniqueBeneficiaries] }
 *         required: true
 *       - in: query
 *         name: groupBy
 *         schema: { type: string, enum: [day, week, month, quarter, year] }
 *         required: true
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: entityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: entityType
 *         schema: { type: string, enum: [project, subproject, activity] }
 *       - in: query
 *         name: projectId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: subprojectId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: activityId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: beneficiaryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: beneficiaryIds
 *         schema: { type: string }
 *       - in: query
 *         name: serviceId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: serviceIds
 *         schema: { type: string }
 *       - in: query
 *         name: formTemplateId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formTemplateIds
 *         schema: { type: string }
 *       - in: query
 *         name: dataFilters
 *         schema:
 *           type: string
 *         required: false
 *         description: JSON array string of ad-hoc filters, e.g. [{"field":"gender","op":"eq","value":"F"}]
 *     responses:
 *       200:
 *         description: Time series for the selected metric, with summary totals and most frequent services
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
 *                     metric:
 *                       type: string
 *                       enum: [submissions, serviceDeliveries, uniqueBeneficiaries]
 *                     granularity:
 *                       type: string
 *                       enum: [day, week, month, quarter, year]
 *                     series:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           periodStart:
 *                             type: string
 *                             format: date-time
 *                           value:
 *                             type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalSubmissions:
 *                           type: integer
 *                         totalServiceDeliveries:
 *                           type: integer
 *                         totalUniqueBeneficiaries:
 *                           type: integer
 *                         mostFrequentServices:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               serviceId:
 *                                 type: string
 *                                 format: uuid
 *                               name:
 *                                 type: string
 *                                 nullable: true
 *                               count:
 *                                 type: integer
 */
router.get(
  "/metrics/series",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.kpis.getMetricsSeries(req, res);
  }
);

export default router;
