import { Router, Request, Response } from "express";
import activitiesController from "../../controllers/activities/index";
import { authenticate, authorize } from "../../middlewares/auth";
import roles, { ROLES } from "../../constants/roles";
import loggerMiddleware from "../../middlewares/logger";
import assignmentsController from "../../controllers/assignments/assignments";

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     Activity:
 *       type: object
 *       required:
 *         - name
 *         - subprojectId
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The auto-generated UUID of the activity
 *         name:
 *           type: string
 *           description: The name of the activity
 *         description:
 *           type: string
 *           description: Activity description
 *         category:
 *           type: string
 *           description: Activity category
 *         frequency:
 *           type: string
 *           description: How often the activity occurs (daily, weekly, monthly, etc.)
 *         reportingFields:
 *           type: object
 *           description: JSON structure defining the reporting fields for this activity
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Activity status
 *         subprojectId:
 *           type: string
 *           format: uuid
 *           description: The ID of the parent subproject
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date when activity was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Date when activity was last updated
 *       example:
 *         id: 550e8400-e29b-41d4-a716-446655440000
 *         name: Food Distribution Activity
 *         description: A weekly food distribution activity
 *         category: Food Aid
 *         frequency: weekly
 *         reportingFields: {"beneficiaries": "number", "foodQuantity": "number", "location": "text"}
 *         status: active
 *         subprojectId: 550e8400-e29b-41d4-a716-446655440001
 *         createdAt: '2023-01-01T17:32:28Z'
 *         updatedAt: '2023-01-01T17:32:28Z'
 */

/**
 * @swagger
 * /activities:
 *   get:
 *     summary: Get all activities
 *     tags: [Activities]
 *     responses:
 *       200:
 *         description: List of all activities
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Activity'
 */
router.get("/", authenticate, (req: Request, res: Response): void => {
  activitiesController.getAllActivities(req, res);
});

/**
 * @swagger
 * /activities/{id}:
 *   get:
 *     summary: Get activity by ID
 *     tags: [Activities]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The activity ID
 *     responses:
 *       200:
 *         description: Activity details by ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Activity'
 *       404:
 *         description: Activity not found
 */
router.get("/:id", authenticate, (req: Request, res: Response): void => {
  activitiesController.getActivityById(req, res);
});

/**
 * @swagger
 * /subprojects/{subprojectId}/activities:
 *   get:
 *     summary: Get all activities for a subproject
 *     tags: [Activities]
 *     parameters:
 *       - in: path
 *         name: subprojectId
 *         schema:
 *           type: string
 *         required: true
 *         description: The subproject ID
 *     responses:
 *       200:
 *         description: List of activities for the subproject
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Activity'
 *       404:
 *         description: Subproject not found
 */
router.get("/subproject/:subprojectId", authenticate, (req: Request, res: Response): void => {
  activitiesController.getActivitiesBySubprojectId(req, res);
});

/**
 * @swagger
 * /activities:
 *   post:
 *     summary: Create a new activity
 *     tags: [Activities]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - subprojectId
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               frequency:
 *                 type: string
 *               reportingFields:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *               subprojectId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Activity created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Activity created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Activity'
 *       400:
 *         description: Invalid parameters
 */
router.post(
  "/",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    activitiesController.createActivity(req, res);
  }
);

/**
 * @swagger
 * /activities/{id}:
 *   put:
 *     summary: Update an activity
 *     tags: [Activities]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The activity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               frequency:
 *                 type: string
 *               reportingFields:
 *                 type: object
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Activity updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Activity updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Activity'
 *       404:
 *         description: Activity not found
 */
router.put(
  "/:id",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    activitiesController.updateActivity(req, res);
  }
);

/**
 * @swagger
 * /activities/{id}:
 *   delete:
 *     summary: Delete an activity
 *     tags: [Activities]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The activity ID
 *     responses:
 *       200:
 *         description: Activity deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Activity deleted successfully
 *       404:
 *         description: Activity not found
 */
router.delete(
  "/:id",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    activitiesController.deleteActivity(req, res);
  }
);

/**
 * @swagger
 * /activities/{activityId}/users:
 *   get:
 *     summary: Get all users assigned to an activity
 *     tags: [Activities]
 *     parameters:
 *       - in: path
 *         name: activityId
 *         schema:
 *           type: string
 *         required: true
 *         description: The activity ID
 *     responses:
 *       200:
 *         description: List of users assigned to the activity
 *       404:
 *         description: Activity not found
 */
router.get(
  "/:activityId/users",
  authenticate,
  (req: Request, res: Response): void => {
    assignmentsController.getActivityUsers(req, res);
  }
);

/**
 * @swagger
 * /activities/{activityId}/users:
 *   post:
 *     summary: Assign a user to an activity
 *     tags: [Activities]
 *     parameters:
 *       - in: path
 *         name: activityId
 *         schema:
 *           type: string
 *         required: true
 *         description: The activity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: The user ID to assign
 *     responses:
 *       201:
 *         description: User assigned to activity successfully
 *       400:
 *         description: Invalid parameters or user already assigned
 *       404:
 *         description: Activity or user not found
 */
router.post(
  "/:activityId/users",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    assignmentsController.assignUserToActivity(req, res);
  }
);

/**
 * @swagger
 * /activities/{activityId}/users/{userId}:
 *   delete:
 *     summary: Remove a user from an activity
 *     tags: [Activities]
 *     parameters:
 *       - in: path
 *         name: activityId
 *         schema:
 *           type: string
 *         required: true
 *         description: The activity ID
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User removed from activity successfully
 *       404:
 *         description: User not assigned to this activity
 */
router.delete(
  "/:activityId/users/:userId",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    assignmentsController.removeUserFromActivity(req, res);
  }
);

export default router;
