import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth';
import loggerMiddleware from '../middlewares/logger';
import { dataDump, upload } from '../controllers/syncService';

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * tags:
 *   name: SyncService
 *   description: Minimal sync service for Flutter offline functionality
 */

/**
 * @swagger
 * /sync/datadump:
 *   get:
 *     summary: Get complete dataset for Flutter offline use
 *     description: Returns all RBAC-scoped data in a single JSON response for offline functionality
 *     tags: [SyncService]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Complete dataset for offline use
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 meta:
 *                   type: object
 *                   properties:
 *                     schemaVersion:
 *                       type: integer
 *                       example: 1
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                     userId:
 *                       type: string
 *                     roleNames:
 *                       type: array
 *                       items:
 *                         type: string
 *                     isAdmin:
 *                       type: boolean
 *                     allowedPrograms:
 *                       type: array
 *                       items:
 *                         type: string
 *                 projects:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 subprojects:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       projectId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 activities:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       subprojectId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category:
 *                         type: string
 *                       frequency:
 *                         type: string
 *                       reportingFields:
 *                         type: object
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       email:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 form_templates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       schema:
 *                         type: object
 *                       version:
 *                         type: integer
 *                       status:
 *                         type: string
 *                       includeBeneficiaries:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 form_responses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       formTemplateId:
 *                         type: string
 *                       entityId:
 *                         type: string
 *                       entityType:
 *                         type: string
 *                       values:
 *                         type: object
 *                       submittedAt:
 *                         type: string
 *                         format: date-time
 *                       submittedBy:
 *                         type: string
 *                       formTemplate:
 *                         type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 beneficiaries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       pseudonym:
 *                         type: string
 *                       status:
 *                         type: string
 *                       piiEnc:
 *                         type: object
 *                         description: Encrypted PII data
 *                       pii:
 *                         type: object
 *                         description: Decrypted PII data (if user has permission)
 *                         properties:
 *                           beneficiaryId:
 *                             type: string
 *                             description: Unique identifier linking PII to beneficiary
 *                           firstName:
 *                             type: string
 *                           lastName:
 *                             type: string
 *                           dob:
 *                             type: string
 *                           gender:
 *                             type: string
 *                           address:
 *                             type: string
 *                           phone:
 *                             type: string
 *                           email:
 *                             type: string
 *                 services:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 service_deliveries:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       serviceId:
 *                         type: string
 *                       beneficiaryId:
 *                         type: string
 *                       staffUserId:
 *                         type: string
 *                       entityId:
 *                         type: string
 *                       entityType:
 *                         type: string
 *                       deliveredAt:
 *                         type: string
 *                         format: date-time
 *                       notes:
 *                         type: string
 *                       service:
 *                         type: object
 *                       staffUser:
 *                         type: object
 *                       beneficiary:
 *                         type: object
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/datadump', authenticate, dataDump);

/**
 * @swagger
 * /sync/uploads:
 *   post:
 *     summary: Upload offline survey responses from Flutter
 *     description: Processes completed survey responses from Flutter and stores them in the correct relational database tables
 *     tags: [SyncService]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               surveys:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     clientRequestId:
 *                       type: string
 *                       description: Unique identifier generated by Flutter for idempotency
 *                     projectId:
 *                       type: string
 *                       description: ID of the project this survey belongs to
 *                     subprojectId:
 *                       type: string
 *                       description: ID of the subproject this survey belongs to
 *                     formId:
 *                       type: string
 *                       description: ID of the form template used for this survey
 *                     beneficiaryId:
 *                       type: string
 *                       description: Optional ID of the beneficiary this survey is about
 *                     serviceIds:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Array of service IDs delivered during this survey
 *                     answers:
 *                       type: object
 *                       description: The actual survey responses (field names match form schema)
 *                     metadata:
 *                       type: object
 *                       description: Additional context about the survey submission
 *                       properties:
 *                         deviceId:
 *                           type: string
 *                         appVersion:
 *                           type: string
 *                         location:
 *                           type: object
 *                           properties:
 *                             lat:
 *                               type: number
 *                             lng:
 *                               type: number
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *             example:
 *               surveys:
 *                 - clientRequestId: "local-uuid-123"
 *                   projectId: "p-001"
 *                   subprojectId: "sp-100"
 *                   formId: "f-123"
 *                   beneficiaryId: "b-501"
 *                   serviceIds: ["svc-55"]
 *                   answers:
 *                     household_head: "Ilir"
 *                     members_count: 5
 *                     water_source: "well"
 *                   metadata:
 *                     deviceId: "android-xyz"
 *                     appVersion: "1.3.0"
 *                     location: { lat: 42.3, lng: 21.1 }
 *                     timestamp: "2025-10-15T09:00:00Z"
 *     responses:
 *       200:
 *         description: Upload results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, error]
 *                 manifestId:
 *                   type: string
 *                   description: Unique manifest ID for tracking
 *                 manifest:
 *                   type: object
 *                   description: Comprehensive manifest with detailed survey information
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Manifest ID
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                       description: When the manifest was generated
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalSurveys:
 *                           type: integer
 *                           description: Total number of surveys processed
 *                         successfulSurveys:
 *                           type: integer
 *                           description: Number of successfully processed surveys
 *                         failedSurveys:
 *                           type: integer
 *                           description: Number of failed surveys
 *                         successRate:
 *                           type: string
 *                           description: Success rate percentage
 *                     forms:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           description: Number of unique forms used
 *                         forms:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                               version: { type: integer }
 *                               includeBeneficiaries: { type: boolean }
 *                               fieldCount: { type: integer }
 *                               usageCount: { type: integer }
 *                     projects:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           description: Number of unique projects involved
 *                         projects:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                               category: { type: string }
 *                               status: { type: string }
 *                     subprojects:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           description: Number of unique subprojects involved
 *                         subprojects:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                               category: { type: string }
 *                               status: { type: string }
 *                               projectId: { type: string }
 *                     beneficiaries:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           description: Number of unique beneficiaries surveyed
 *                         surveyed:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Array of beneficiary IDs that were surveyed
 *                         created:
 *                           type: integer
 *                           description: Number of new beneficiaries created
 *                         existing:
 *                           type: integer
 *                           description: Number of existing beneficiaries surveyed
 *                     services:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           description: Number of unique services delivered
 *                         services:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                               description: { type: string }
 *                               category: { type: string }
 *                               deliveryCount: { type: integer }
 *                         totalDeliveries:
 *                           type: integer
 *                           description: Total number of service deliveries
 *                     data:
 *                       type: array
 *                       description: Detailed manifest data for each survey
 *                       items:
 *                         type: object
 *                         properties:
 *                           clientRequestId:
 *                             type: string
 *                           serverSurveyId:
 *                             type: string
 *                           form:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                               version: { type: integer }
 *                               includeBeneficiaries: { type: boolean }
 *                               schema:
 *                                 type: object
 *                                 properties:
 *                                   fields: { type: array }
 *                                   fieldCount: { type: integer }
 *                           project:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                               description: { type: string }
 *                               category: { type: string }
 *                               status: { type: string }
 *                           subproject:
 *                             type: object
 *                             properties:
 *                               id: { type: string }
 *                               name: { type: string }
 *                               description: { type: string }
 *                               category: { type: string }
 *                               status: { type: string }
 *                           beneficiary:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               id: { type: string }
 *                               status: { type: string }
 *                               wasCreated: { type: boolean }
 *                               wasExisting: { type: boolean }
 *                           services:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 id: { type: string }
 *                                 deliveryId: { type: string }
 *                                 deliveredAt: { type: string, format: date-time }
 *                                 notes: { type: string }
 *                                 service:
 *                                   type: object
 *                                   properties:
 *                                     id: { type: string }
 *                                     name: { type: string }
 *                                     description: { type: string }
 *                                     category: { type: string }
 *                           surveyData:
 *                             type: object
 *                             properties:
 *                               submittedAt: { type: string, format: date-time }
 *                               location:
 *                                 type: object
 *                                 nullable: true
 *                                 properties:
 *                                   lat: { type: number }
 *                                   lng: { type: number }
 *                               deviceInfo:
 *                                 type: object
 *                                 properties:
 *                                   deviceId: { type: string }
 *                                   appVersion: { type: string }
 *                               answersCount: { type: integer }
 *                               hasLocation: { type: boolean }
 *                               fieldAnswers:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     field: { type: string }
 *                                     value: { type: string }
 *                                     type: { type: string }
 *                           processing:
 *                             type: object
 *                             properties:
 *                               processedAt: { type: string, format: date-time }
 *                               processingTimeMs: { type: integer }
 *                               transactionId: { type: string }
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       clientRequestId:
 *                         type: string
 *                       serverSurveyId:
 *                         type: string
 *                         description: Server-generated ID for successful survey processing
 *                       manifestId:
 *                         type: string
 *                         description: Unique manifest ID for tracking
 *                       status:
 *                         type: string
 *                         enum: [applied, error]
 *                       entityType:
 *                         type: string
 *                         description: Type of entity processed
 *                       message:
 *                         type: string
 *                         description: Error message for failed surveys
 *             example:
 *               status: "ok"
 *               manifestId: "manifest-2025-10-15T09:00:01Z"
 *               manifest:
 *                 id: "manifest-2025-10-15T09:00:01Z"
 *                 generatedAt: "2025-10-15T09:00:01.000Z"
 *                 summary:
 *                   totalSurveys: 2
 *                   successfulSurveys: 1
 *                   failedSurveys: 1
 *                   successRate: "50.00%"
 *                 forms:
 *                   count: 1
 *                   forms:
 *                     - id: "f-123"
 *                       name: "Household Survey"
 *                       version: 2
 *                       includeBeneficiaries: true
 *                       fieldCount: 3
 *                       usageCount: 1
 *                 projects:
 *                   count: 1
 *                   projects:
 *                     - id: "p-001"
 *                       name: "Health Outreach"
 *                       category: "health"
 *                       status: "active"
 *                 subprojects:
 *                   count: 1
 *                   subprojects:
 *                     - id: "sp-100"
 *                       name: "Village A"
 *                       category: "rural"
 *                       status: "active"
 *                       projectId: "p-001"
 *                 beneficiaries:
 *                   count: 1
 *                   surveyed: ["b-501"]
 *                   created: 1
 *                   existing: 0
 *                 services:
 *                   count: 1
 *                   services:
 *                     - id: "svc-55"
 *                       name: "Medical Checkup"
 *                       description: "Basic health examination"
 *                       category: "health"
 *                       deliveryCount: 1
 *                   totalDeliveries: 1
 *                 data:
 *                   - clientRequestId: "local-uuid-123"
 *                     serverSurveyId: "srv-abc-999"
 *                     form:
 *                       id: "f-123"
 *                       name: "Household Survey"
 *                       version: 2
 *                       includeBeneficiaries: true
 *                       schema:
 *                         fields: [{"name": "household_head", "type": "Text"}, {"name": "members_count", "type": "Number"}]
 *                         fieldCount: 2
 *                     project:
 *                       id: "p-001"
 *                       name: "Health Outreach"
 *                       description: "Community health program"
 *                       category: "health"
 *                       status: "active"
 *                     subproject:
 *                       id: "sp-100"
 *                       name: "Village A"
 *                       description: "Health services for Village A"
 *                       category: "rural"
 *                       status: "active"
 *                     beneficiary:
 *                       id: "b-501"
 *                       status: "processed"
 *                       wasCreated: true
 *                       wasExisting: false
 *                     services:
 *                       - id: "svc-55"
 *                         deliveryId: "sd-001"
 *                         deliveredAt: "2025-10-15T09:00:00Z"
 *                         notes: "Offline survey submission - android-xyz"
 *                         service:
 *                           id: "svc-55"
 *                           name: "Medical Checkup"
 *                           description: "Basic health examination"
 *                           category: "health"
 *                     surveyData:
 *                       submittedAt: "2025-10-15T09:00:00Z"
 *                       location:
 *                         lat: 42.3
 *                         lng: 21.1
 *                       deviceInfo:
 *                         deviceId: "android-xyz"
 *                         appVersion: "1.3.0"
 *                       answersCount: 2
 *                       hasLocation: true
 *                       fieldAnswers:
 *                         - field: "household_head"
 *                           value: "Ilir"
 *                           type: "string"
 *                         - field: "members_count"
 *                           value: 5
 *                           type: "number"
 *                     processing:
 *                       processedAt: "2025-10-15T09:00:01.000Z"
 *                       processingTimeMs: 1000
 *                       transactionId: "tx-123"
 *               results:
 *                 - clientRequestId: "local-uuid-123"
 *                   serverSurveyId: "srv-abc-999"
 *                   manifestId: "manifest-2025-10-15T09:00:01Z"
 *                   status: "applied"
 *                   entityType: "formSubmission"
 *                 - clientRequestId: "local-uuid-124"
 *                   status: "error"
 *                   message: "Form validation failed"
 *       400:
 *         description: Bad request - invalid surveys format
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/uploads', authenticate, upload);

export default router;
