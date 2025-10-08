import { Router, Request, Response } from 'express';
import usersController from '../../controllers/users';
import { authenticate, authorize } from '../../middlewares/auth';
import loggerMiddleware from '../../middlewares/logger';
import { ROLES } from '../../constants/roles';

const router = Router();

// Apply logger middleware to all routes in this router
router.use(loggerMiddleware);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a list of all users. Accessible by admins and program managers.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', 
  authenticate, 
  (req: Request, res: Response): void => {
    usersController.getAllUsers(req, res);
  }
);

/**
 * @swagger
 * /users/my-team:
 *   get:
 *     summary: Get team members for the current user
 *     description: Retrieve all employees/users that share at least one entity (project, subproject, or activity) with the authenticated user. Uses hierarchical lookup - if user has access to a project, includes team members from all child subprojects and activities. If user has access to a subproject, includes team members from all child activities. Useful for Program Managers and Sub-Project Managers to see their team.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of team members
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
 *                     teamMembers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     count:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/my-team',
  authenticate,
  (req: Request, res: Response): void => {
    usersController.getMyTeamMembers(req, res);
  }
);

/**
 * @swagger
 * /users/my-beneficiaries:
 *   get:
 *     summary: Get beneficiaries for the current user
 *     description: Retrieve all beneficiaries associated with entities (projects or subprojects) that the authenticated user has access to. Uses hierarchical lookup - if user has access to a project, includes beneficiaries from all child subprojects. Returns both encrypted (piiEnc) and decrypted (pii) PII fields. Includes audit logging and cache control headers for security.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of beneficiaries with both encrypted and decrypted PII
 *         headers:
 *           Cache-Control:
 *             description: Set to no-store when PII is decrypted
 *             schema:
 *               type: string
 *           X-PII-Access:
 *             description: Indicates whether PII was decrypted or returned encrypted
 *             schema:
 *               type: string
 *               enum: [decrypt, encrypted]
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
 *                     beneficiaries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           pseudonym:
 *                             type: string
 *                           status:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           updatedAt:
 *                             type: string
 *                             format: date-time
 *                           piiEnc:
 *                             type: object
 *                             description: Encrypted PII fields
 *                             properties:
 *                               firstNameEnc:
 *                                 type: object
 *                               lastNameEnc:
 *                                 type: object
 *                               dobEnc:
 *                                 type: object
 *                               genderEnc:
 *                                 type: object
 *                               addressEnc:
 *                                 type: object
 *                               municipalityEnc:
 *                                 type: object
 *                               nationalityEnc:
 *                                 type: object
 *                               nationalIdEnc:
 *                                 type: object
 *                               phoneEnc:
 *                                 type: object
 *                               emailEnc:
 *                                 type: object
 *                           pii:
 *                             type: object
 *                             description: Decrypted PII fields (only included for authorized users)
 *                             properties:
 *                               firstName:
 *                                 type: string
 *                               lastName:
 *                                 type: string
 *                               dob:
 *                                 type: string
 *                               gender:
 *                                 type: string
 *                               address:
 *                                 type: string
 *                               municipality:
 *                                 type: string
 *                               nationality:
 *                                 type: string
 *                               nationalId:
 *                                 type: string
 *                               phone:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                     count:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/my-beneficiaries',
  authenticate,
  (req: Request, res: Response): void => {
    usersController.getMyBeneficiaries(req, res);
  }
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve a single user by ID. Accessible by admins and program managers.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', 
  authenticate, 
  (req: Request, res: Response): void => {
    usersController.getUserById(req, res);
  }
);

/**
 * @swagger
 * /users/{id}/projects:
 *   get:
 *     summary: Get projects with nested subprojects and activities associated to a user
 *     description: Returns all projects the user belongs to, subprojects the user belongs to, and activities the user belongs to, with activities nested under subprojects and subprojects nested under their parent projects.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: List of projects with nested subprojects and activities
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/:id/projects',
  authenticate,
  (req: Request, res: Response): void => {
    usersController.getUserProjectsWithSubprojects(req, res);
  }
);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     description: Create a new user with roles..
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - password
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               roleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', 
  (req: Request, res: Response): void => {
    usersController.createUser(req, res);
  }
);

/**
 * @swagger
 * /users/me:
 *   put:
 *     summary: Update my profile
 *     description: Update the authenticated user's own profile information (firstName, lastName, email).
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/me',
  authenticate,
  (req: Request, res: Response): void => {
    usersController.updateMyProfile(req, res);
  }
);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user
 *     description: Update user details. Accessible only by system administrators.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *               roleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   description: Role UUID
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id', 
  authenticate, 
  // authorize(['System Administrator']), 
  (req: Request, res: Response): void => {
    usersController.updateUser(req, res);
  }
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user
 *     description: Delete a user by ID. Accessible only by system administrators.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:id', 
  authenticate, 
  // authorize(['System Administrator']), 
  (req: Request, res: Response): void => {
    usersController.deleteUser(req, res);
  }
);

/**
 * @swagger
 * /users/{id}/reset-password:
 *   post:
 *     summary: Reset user password
 *     description: Admin function to reset a user's password. Accessible only by system administrators.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 newPassword:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:id/reset-password', 
  authenticate, 
  // authorize(['System Administrator']), 
  (req: Request, res: Response): void => {
    usersController.resetPassword(req, res);
  }
);

/**
 * @swagger
 * /users/invite:
 *   post:
 *     summary: Invite a new user
 *     description: Send an invitation to a new user with a verification token. Accessible only by system administrators.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - firstName
 *               - lastName
 *               - email
 *               - roleIds
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               roleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   description: Role UUID
 *               message:
 *                 type: string
 *                 description: Optional invitation message to include in the email
 *               projectId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional project to auto-assign the invited user to. Ignored if subprojectId is also provided.
 *               subprojectId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional subproject to auto-assign the invited user to. Takes precedence over projectId if both provided.
 *     responses:
 *       201:
 *         description: Invitation sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 verificationToken:
 *                   type: string
 *                   description: Token for testing purposes
 *       400:
 *         description: Invalid input
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/invite', 
  authenticate, 
  // authorize(['System Administrator']), 
  (req: Request, res: Response): void => {
    usersController.inviteUser(req, res);
  }
);

export default router;
