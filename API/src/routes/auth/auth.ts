import { Router, Request, Response, NextFunction } from 'express';
import authController from '../../controllers/auth';
import usersController from '../../controllers/users';
import { authenticate } from '../../middlewares/auth';
import loggerMiddleware from '../../middlewares/logger';

const router = Router();

// Apply logger middleware to all routes in this router
router.use(loggerMiddleware);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Authenticate user & get token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/login', (req: Request, res: Response): void => {
  authController.login(req, res);
});

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset email
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Generic success message
 *       400:
 *         description: Invalid input
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/forgot-password', (req: Request, res: Response): void => {
  (authController as any).forgotPassword(req, res);
});

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset
 *       400:
 *         description: Invalid or expired token, or input invalid
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/reset-password', (req: Request, res: Response): void => {
  (authController as any).resetPassword(req, res);
});

/**
 * @swagger
 * /auth/mfa/verify:
 *   post:
 *     summary: Verify TOTP or recovery code to complete login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - mfaTempToken
 *             properties:
 *               code:
 *                 type: string
 *                 description: 6-digit TOTP code or a recovery code
 *               mfaTempToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: MFA verified, JWT issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing code or token
 *       401:
 *         description: Invalid or expired code
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/mfa/verify', (req: Request, res: Response): void => {
  authController.verifyMfa(req, res);
});

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/profile', authenticate, (req: Request, res: Response): void => {
  authController.getProfile(req, res);
});

/**
 * @swagger
 * /auth/mfa/setup/start:
 *   post:
 *     summary: Start TOTP setup for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Returns TOTP secret and otpauth URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     secret:
 *                       type: string
 *                     otpauthUrl:
 *                       type: string
 *                     qrCodeDataUrl:
 *                       type: string
 *                       description: Optional QR code data URL
 *                     enrollmentToken:
 *                       type: string
 *                       description: One-time token to confirm setup without code (Option A)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/mfa/setup/start', authenticate, (req: Request, res: Response): void => {
  authController.startTotpSetup(req, res);
});

/**
 * @swagger
 * /auth/mfa/setup/confirm:
 *   post:
 *     summary: Confirm TOTP setup with a valid 6-digit code
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *               enrollmentToken:
 *                 type: string
 *                 description: One-time token to enable 2FA without code (Option A)
 *     responses:
 *       200:
 *         description: 2FA enabled and recovery codes returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     recoveryCodes:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Setup not started or missing code
 *       401:
 *         description: Invalid code
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/mfa/setup/confirm', authenticate, (req: Request, res: Response): void => {
  authController.confirmTotpSetup(req, res);
});

/**
 * @swagger
 * /auth/mfa/recovery-codes:
 *   get:
 *     summary: Regenerate and return recovery codes for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Recovery codes returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     recoveryCodes:
 *                       type: array
 *                       items:
 *                         type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/mfa/recovery-codes', authenticate, (req: Request, res: Response): void => {
  authController.getRecoveryCodes(req, res);
});

/**
 * @swagger
 * /auth/mfa/disable:
 *   post:
 *     summary: Disable 2FA for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA disabled
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/mfa/disable', authenticate, (req: Request, res: Response): void => {
  authController.disableTotp(req, res);
});
/**
 * @swagger
 * /auth/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/change-password', authenticate, (req: Request, res: Response): void => {
  authController.changePassword(req, res);
});

 

/**
 * @swagger
 * /auth/accept-invitation:
 *   post:
 *     summary: Accept an invitation by setting a password and activating the account
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - token
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Account activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input or expired token
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/accept-invitation', (req: Request, res: Response): void => {
  usersController.acceptInvitation(req, res);
});

export default router;
