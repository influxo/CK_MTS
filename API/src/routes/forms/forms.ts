import { Router, Request, Response } from "express";
import formsController from "../../controllers/forms";
import { authenticate, authorize } from "../../middlewares/auth";
import { ROLES } from "../../constants/roles";
import loggerMiddleware from "../../middlewares/logger";

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     FormTemplate:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - programId
 *         - schema
 *         - version
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the form template
 *         name:
 *           type: string
 *           description: Name of the form template
 *         programId:
 *           type: string
 *           format: uuid
 *           description: ID of the program this form belongs to
 *         schema:
 *           type: object
 *           description: JSON schema defining the form structure
 *         version:
 *           type: integer
 *           description: Version number of the form template
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           description: Soft delete timestamp (null if not deleted)
 *     FormResponse:
 *       type: object
 *       required:
 *         - id
 *         - form_template_id
 *         - programId
 *         - submitted_by
 *         - data
 *         - submitted_at
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the form response
 *         form_template_id:
 *           type: string
 *           format: uuid
 *           description: ID of the form template this response is for
 *         programId:
 *           type: string
 *           format: uuid
 *           description: ID of the program this response belongs to
 *         submitted_by:
 *           type: string
 *           format: uuid
 *           description: ID of the user who submitted this response
 *         data:
 *           type: object
 *           description: JSON data containing the form responses
 *         latitude:
 *           type: number
 *           format: decimal
 *           description: Optional GPS latitude coordinate (decimal degrees, 9,6 precision)
 *         longitude:
 *           type: number
 *           format: decimal
 *           description: Optional GPS longitude coordinate (decimal degrees, 9,6 precision)
 *         submitted_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the response was submitted
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

/**
 * @swagger
 * /forms/templates:
 *   post:
 *     summary: Create a new form template
 *     tags: [Forms]
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
 *               - programId
 *               - schema
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the form template
 *               programId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the program or subproject this form belongs to
 *               schema:
 *                 type: object
 *                 description: Form schema definition
 *                 required:
 *                   - fields
 *                 properties:
 *                   fields:
 *                     type: array
 *                     items:
 *                       type: object
 *                       required:
 *                         - name
 *                         - label
 *                         - type
 *                       properties:
 *                         name:
 *                           type: string
 *                           description: Field name/identifier
 *                         label:
 *                           type: string
 *                           description: Display label for the field
 *                         type:
 *                           type: string
 *                           enum: [Text, Number, Date, Dropdown, Checkbox]
 *                           description: Field type
 *                         required:
 *                           type: boolean
 *                           description: Whether the field is required
 *                         options:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Options for dropdown fields
 *     responses:
 *       201:
 *         description: Form template created successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user does not have required permissions
 */
router.post(
  "/templates",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    formsController.templates.createFormTemplate(req, res);
  }
);

/**
 * @swagger
 * /forms/templates/{id}:
 *   put:
 *     summary: Update an existing form template
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: The form template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name of the form template
 *               schema:
 *                 type: object
 *                 description: Form schema definition
 *     responses:
 *       200:
 *         description: Form template updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user does not have required permissions
 *       404:
 *         description: Form template not found
 */
router.put(
  "/templates/:id",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    formsController.templates.updateFormTemplate(req, res);
  }
);

/**
 * @swagger
 * /forms/templates/{id}:
 *   get:
 *     summary: Get a form template by ID
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: The form template ID
 *     responses:
 *       200:
 *         description: Form template details
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user does not have access
 *       404:
 *         description: Form template not found
 */
router.get(
  "/templates/:id",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.templates.getFormTemplateById(req, res);
  }
);

/**
 * @swagger
 * /forms/templates:
 *   get:
 *     summary: Get all form templates for a program
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: programId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: The program/subproject ID
 *     responses:
 *       200:
 *         description: List of form templates
 *       400:
 *         description: Missing program ID parameter
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user does not have access
 */
router.get(
  "/templates",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.templates.getFormTemplatesByProgram(req, res);
  }
);

/**
 * @swagger
 * /forms/templates/{id}/responses:
 *   post:
 *     summary: Submit a response to a form
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: The form template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Form response data matching the template schema
 *     responses:
 *       201:
 *         description: Form response submitted successfully
 *       400:
 *         description: Invalid input or validation errors
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user does not have required permissions
 *       404:
 *         description: Form template not found
 */
router.post(
  "/templates/:id/responses",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER, ROLES.FIELD_OPERATOR]),
  (req: Request, res: Response): void => {
    formsController.responses.submitFormResponse(req, res);
  }
);

/**
 * @swagger
 * /forms/templates/{id}/responses:
 *   get:
 *     summary: Get all responses for a form template
 *     tags: [Forms]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: The form template ID
 *     responses:
 *       200:
 *         description: List of form responses
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - user does not have access
 *       404:
 *         description: Form template not found
 */
router.get(
  "/templates/:id/responses",
  authenticate,
  (req: Request, res: Response): void => {
    formsController.responses.getFormResponses(req, res);
  }
);

export default router;
