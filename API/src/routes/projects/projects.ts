import { Router, Request, Response } from "express";
import projectsController from "../../controllers/projects/index";
import { authenticate, authorize } from "../../middlewares/auth";
import roles, { ROLES } from "../../constants/roles";
import loggerMiddleware from "../../middlewares/logger";

const router = Router();

router.use(loggerMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     Project:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: The auto-generated UUID of the project
 *         name:
 *           type: string
 *           description: The name of the project
 *         description:
 *           type: string
 *           description: Project description
 *         category:
 *           type: string
 *           description: Project category
 *         status:
 *           type: string
 *           enum: [active, inactive]
 *           description: Project status
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Date when project was created
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Date when project was last updated
 *       example:
 *         id: 550e8400-e29b-41d4-a716-446655440000
 *         name: Food Distribution Project
 *         description: A project to distribute food to the needy
 *         category: Food Aid
 *         status: active
 *         createdAt: '2023-01-01T17:32:28Z'
 *         updatedAt: '2023-01-01T17:32:28Z'
 */

/**
 * @swagger
 * /projects:
 *   get:
 *     summary: Get all projects
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: List of all projects
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
 *                     $ref: '#/components/schemas/Project'
 */
router.get("/", authenticate, (req: Request, res: Response): void => {
  projectsController.getAllProjects(req, res);
});

/**
 * @swagger
 * /projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The project ID
 *     responses:
 *       200:
 *         description: Project details by ID
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       404:
 *         description: Project not found
 */

router.get("/:id", authenticate, (req: Request, res: Response): void => {
  projectsController.getProjectById(req, res);
});

/**
 * @swagger
 * /projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
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
 *       201:
 *         description: Project created successfully
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
 *                   example: Project created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         description: Invalid parameters
 */
router.post(
  "/",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    projectsController.createProject(req, res);
  }
);

/**
 * @swagger
 * /projects/{id}:
 *   put:
 *     summary: Update a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The project ID
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
 *         description: Project updated successfully
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
 *                   example: Project updated successfully
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *       404:
 *         description: Project not found
 */

router.put(
  "/:id",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR, ROLES.PROGRAM_MANAGER]),
  (req: Request, res: Response): void => {
    projectsController.updateProject(req, res);
  }
);

/**
 * @swagger
 * /projects/{id}:
 *   delete:
 *     summary: Delete a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The project ID
 *     responses:
 *       200:
 *         description: Project deleted successfully
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
 *                   example: Project deleted successfully
 *       404:
 *         description: Project not found
 */

router.delete(
  "/:id",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    projectsController.deleteProject(req, res);
  }
);

/**
 * @swagger
 * /projects/{projectId}/users:
 *   get:
 *     summary: Get all users assigned to a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         schema:
 *           type: string
 *         required: true
 *         description: The project ID
 *     responses:
 *       200:
 *         description: List of users assigned to the project
 *       404:
 *         description: Project not found
 */
router.get(
  "/:projectId/users",
  authenticate,
  (req: Request, res: Response): void => {
    projectsController.assignments.getProjectUsers(req, res);
  }
);

/**
 * @swagger
 * /projects/{projectId}/users:
 *   post:
 *     summary: Assign a user to a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         schema:
 *           type: string
 *         required: true
 *         description: The project ID
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
 *         description: User assigned to project successfully
 *       400:
 *         description: Invalid parameters or user already assigned
 *       404:
 *         description: Project or user not found
 */
router.post(
  "/:projectId/users",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    projectsController.assignments.assignUserToProject(req, res);
  }
);

/**
 * @swagger
 * /projects/{projectId}/users/{userId}:
 *   delete:
 *     summary: Remove a user from a project
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: projectId
 *         schema:
 *           type: string
 *         required: true
 *         description: The project ID
 *       - in: path
 *         name: userId
 *         schema:
 *           type: string
 *         required: true
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User removed from project successfully
 *       404:
 *         description: User not assigned to this project
 */
router.delete(
  "/:projectId/users/:userId",
  authenticate,
  authorize([ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMINISTRATOR]),
  (req: Request, res: Response): void => {
    projectsController.assignments.removeUserFromProject(req, res);
  }
);

export default router;
