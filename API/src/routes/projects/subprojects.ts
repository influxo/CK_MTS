import { Router, Request, Response } from "express";
import subprojectsController from "../../controllers/subprojects/index";
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
 *     Subproject:
 *       type: object
 *       required:
 *         - name
 *         - projectId
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The auto-generated UUID of the subproject
 *         name:
 *           type: string
 *           description: The name of the subproject
 *         description:
 *           type: string
 *           description: Subproject description
 *         category:
 *           type: string
 *           description: Subproject category
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Subproject status
 *         projectId:
 *           type: string
 *           format: uuid
 *           description: The ID of the parent project
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date when subproject was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Date when subproject was last updated
 *       example:
 *         id: 550e8400-e29b-41d4-a716-446655440000
 *         name: Food Distribution Subproject
 *         description: A subproject to distribute food to the needy
 *         category: Food Aid
 *         status: active
 *         projectId: 550e8400-e29b-41d4-a716-446655440001
 *         createdAt: '2023-01-01T17:32:28Z'
 *         updatedAt: '2023-01-01T17:32:28Z'
 */

/**
 * @swagger
 * /subprojects:
 *   get:
 *     summary: Get all subprojects
 *     tags: [Subprojects]
 *     responses:
 *       200:
 *         description: List of all subprojects
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
 *                     $ref: '#/components/schemas/Subproject'
 */
router.get("/", authenticate, (req: Request, res: Response): void => {
  subprojectsController.getAllSubprojects(req, res);
});

/**
 * @swagger
 * /subprojects/{id}:
 *   get:
 *     summary: Get subproject by ID
 *     tags: [Subprojects]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The subproject ID
 *     responses:
 *       200:
 *         description: Subproject details by ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Subproject'
 *       404:
 *         description: Subproject not found
 */
router.get("/:id", authenticate, (req: Request, res: Response): void => {
  subprojectsController.getSubprojectById(req, res);
});

/**
 * @swagger
 * /subprojects/project/{projectId}:
 *   get:
 *     summary: Get all subprojects for a project
 *     tags: [Subprojects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         schema:
 *           type: string
 *         required: true
 *         description: The project ID
 *     responses:
 *       200:
 *         description: List of subprojects for the project
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
 *                     $ref: '#/components/schemas/Subproject'
 *       404:
 *         description: Project not found
 */
router.get(
  "/project/:projectId",
  authenticate,
  (req: Request, res: Response): void => {
    subprojectsController.getSubprojectsByProjectId(req, res);
    console.log("TEST TEST TEST TESST");
  }
);

/**
 * @swagger
 * /subprojects:
 *   post:
 *     summary: Create a new subproject
 *     tags: [Subprojects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - projectId
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *               projectId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Subproject created successfully
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
 *                   example: Subproject created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Subproject'
 *       400:
 *         description: Invalid parameters
 */
router.post(
  "/",
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR,ROLES.PROGRAM_MANAGER,]),
  (req: Request, res: Response): void => {
    subprojectsController.createSubproject(req, res);
  }
);

/**
 * @swagger
 * /subprojects/{id}:
 *   put:
 *     summary: Update a subproject
 *     tags: [Subprojects]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The subproject ID
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
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Subproject updated successfully
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
 *                   example: Subproject updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Subproject'
 *       404:
 *         description: Subproject not found
 */
router.put(
  "/:id",
  authenticate,
  // authorize([ROLES.SUPER_ADMIN,ROLES.SYSTEM_ADMINISTRATOR,ROLES.PROGRAM_MANAGER,]),
  (req: Request, res: Response): void => {
    subprojectsController.updateSubproject(req, res);
  }
);

/**
 * @swagger
 * /subprojects/{id}:
 *   delete:
 *     summary: Delete a subproject
 *     tags: [Subprojects]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The subproject ID
 *     responses:
 *       200:
 *         description: Subproject deleted successfully
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
 *                   example: Subproject deleted successfully
 *       404:
 *         description: Subproject not found
 */
router.delete(
  "/:id",
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    subprojectsController.deleteSubproject(req, res);
  }
);

/**
 * @swagger
 * /subprojects/{subprojectId}/users:
 *   get:
 *     summary: Get all users assigned to a subproject
 *     tags: [Subprojects]
 *     parameters:
 *       - in: path
 *         name: subprojectId
 *         schema:
 *           type: string
 *         required: true
 *         description: The subproject ID
 *     responses:
 *       200:
 *         description: List of users assigned to the subproject
 *       404:
 *         description: Subproject not found
 */
router.get(
  "/:subprojectId/users",
  authenticate,
  (req: Request, res: Response): void => {
    assignmentsController.getSubprojectUsers(req, res);
  }
);

/**
 * @swagger
 * /subprojects/{subprojectId}/users:
 *   post:
 *     summary: Assign a user to a subproject
 *     tags: [Subprojects]
 *     parameters:
 *       - in: path
 *         name: subprojectId
 *         schema:
 *           type: string
 *         required: true
 *         description: The subproject ID
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
 *         description: User assigned to subproject successfully
 *       400:
 *         description: Invalid parameters or user already assigned
 *       404:
 *         description: Subproject or user not found
 */
router.post(
  "/:subprojectId/users",
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    assignmentsController.assignUserToSubproject(req, res);
  }
);

/**
 * @swagger
 * /subprojects/{subprojectId}/users/{userId}:
 *   delete:
 *     summary: Remove a user from a subproject
 *     tags: [Subprojects]
 *     parameters:
 *       - in: path
 *         name: subprojectId
 *         schema:
 *           type: string
 *         required: true
 *         description: The subproject ID
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User removed from subproject successfully
 *       404:
 *         description: User not assigned to this subproject
 */
router.delete(
  "/:subprojectId/users/:userId",
  authenticate,
  // authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    assignmentsController.removeUserFromSubproject(req, res);
  }
);

export default router;
