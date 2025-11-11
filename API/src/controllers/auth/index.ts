import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, Role, Project, Subproject, Activity, AuditLog } from '../../models';
import { sendPasswordResetEmail } from '../../utils/mailer';
import { createLogger } from '../../utils/logger';
import {
  issueTempToken,
  consumeTempToken,
  recordTempAttempt,
  startSetup,
  toQrDataUrl,
  getPendingSecret,
  clearPendingSecret,
  verifyTotp,
  generateRecoveryCodes,
  saveRecoveryCodes,
  listRecoveryCodes,
  consumeRecoveryCode,
  issueEnrollmentToken,
  consumeEnrollmentToken,
  getTempToken,
  markTempTokenUsed,
  invalidateTempToken
} from '../../utils/mfa';

// Create a logger instance for this module
const logger = createLogger('auth-controller');

/**
 * Login controller
 * Authenticates user and returns JWT token
 */
export const login = async (req: Request, res: Response) => {
  logger.info('Login attempt', { email: req.body.email });
  
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      logger.warn('Login attempt with missing credentials', { 
        providedFields: { email: !!email, password: !!password } 
      });
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    // Find user with password (using scope)
    logger.info('Finding user by email', { email });
    const user = await User.scope('withPassword').findOne({ 
      where: { email },
      include: [{ association: 'roles' }]
    });

    // Check if user exists
    if (!user) {
      logger.warn('Login attempt with invalid email', { email });
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Check if user is active
    if (user.status !== 'active') {
      logger.warn('Login attempt with inactive account', { email, status: user.status });
      return res.status(403).json({ 
        success: false,
        message: 'Account is inactive. Please contact administrator.' 
      });
    }

    // Check if email is verified
    if (!user.emailVerified) {
      logger.warn('Login attempt with unverified email', { email });
      return res.status(403).json({ 
        success: false,
        message: 'Email not verified. Please verify your email to continue.' 
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn('Login attempt with invalid password', { email });
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // If user has 2FA enabled, return MFA challenge with temp token (no JWT)
    if (user.twoFactorEnabled) {
      const temp = await issueTempToken(user.id);
      logger.info('MFA required, issuing temp token', { userId: user.id });
      return res.status(200).json({
        success: true,
        message: 'MFA required',
        data: { mfaRequired: true, mfaTempToken: temp }
      });
    }

    // Generate JWT token when 2FA not enabled
    logger.info('Generating JWT token for user', { userId: user.id });
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'default_secret_change_me',
      { expiresIn: '24h' }
    );

    // Update last login time
    logger.info('Updating last login time', { userId: user.id });
    await User.update(
      { lastLogin: new Date() },
      { where: { id: user.id } }
    );

    logger.info('Login successful', { userId: user.id });
    // Return user info and token
    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles: user.get('roles'),
          twoFactorEnabled: user.twoFactorEnabled
        }
      }
    });
  } catch (error) {
    logger.error('Login error', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

/**
 * Verify TOTP (or recovery code) to complete login
 */
export const verifyMfa = async (req: Request, res: Response) => {
  try {
    const { code, mfaTempToken } = req.body;
    if (!code || !mfaTempToken) {
      return res.status(400).json({ success: false, message: 'Code and mfaTempToken are required' });
    }

    // Peek token to allow multiple attempts without consuming it
    const peek = await getTempToken(mfaTempToken);
    if (!peek.ok || !peek.userId) {
      // Do not write an AuditLog row with an invalid UUID. Log warning and return 401.
      logger.warn('MFA verify failed (invalid/expired temp token)', { userId: peek.userId, reason: peek.reason });
      return res.status(401).json({ success: false, message: 'Invalid or expired code' });
    }

    const user = await User.scope('withPassword').findByPk(peek.userId, { include: [{ association: 'roles' }] });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      await AuditLog.create({ userId: peek.userId, action: 'mfa.verify.fail', description: 'MFA verify failed (user not eligible)' });
      return res.status(401).json({ success: false, message: 'Invalid or expired code' });
    }

    const numeric = String(code).replace(/\D/g, '');
    let ok = verifyTotp(user.twoFactorSecret, numeric);
    if (!ok) {
      // Try as recovery code
      ok = consumeRecoveryCode(user.id, String(code));
    }

    if (!ok) {
      const attempts = await recordTempAttempt(mfaTempToken);
      if (attempts >= 5) {
        invalidateTempToken(mfaTempToken);
      }
      await AuditLog.create({ userId: user.id, action: 'mfa.verify.fail', description: 'MFA verify failed (invalid code)' });
      return res.status(401).json({ success: false, message: 'Invalid or expired code' });
    }

    // Issue real JWT
    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET || 'default_secret_change_me',
      { expiresIn: '24h' }
    );

    await User.update({ lastLogin: new Date() }, { where: { id: user.id } });
    // Mark token used after successful verification
    await markTempTokenUsed(mfaTempToken);
    await AuditLog.create({ userId: user.id, action: 'mfa.verify.success', description: 'MFA verify success' });

    return res.status(200).json({
      success: true,
      message: 'OK',
      data: {
        token,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          roles: user.get('roles'),
          twoFactorEnabled: user.twoFactorEnabled
        }
      }
    });
  } catch (error) {
    logger.error('MFA verify error', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Start TOTP setup for the authenticated user
 */
export const startTotpSetup = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { secret, otpauthUrl } = startSetup(userId);
    const data: any = { secret, otpauthUrl };
    try {
      // Always attempt to include QR image for better UX; fail-soft on errors
      data.qrCodeDataUrl = await toQrDataUrl(otpauthUrl);
    } catch (e) {
      logger.warn('QR code generation failed; falling back to otpauthUrl only', { error: (e as Error).message });
    }
    // Issue enrollment token for code-less confirmation (Option A)
    data.enrollmentToken = issueEnrollmentToken(userId);
    await AuditLog.create({ userId, action: 'mfa.setup.start', description: 'Started TOTP setup' });
    return res.status(200).json({ success: true, message: 'OK', data });
  } catch (error) {
    logger.error('Start TOTP setup error', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Confirm TOTP setup
 */
export const confirmTotpSetup = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const { code, enrollmentToken } = req.body || {};

    const pending = getPendingSecret(userId);
    if (!pending) return res.status(400).json({ success: false, message: 'Setup not started' });

    let permitted = false;
    if (code) {
      permitted = verifyTotp(pending, String(code));
      if (!permitted) return res.status(401).json({ success: false, message: 'Invalid or expired code' });
    } else if (enrollmentToken) {
      const consumed = consumeEnrollmentToken(String(enrollmentToken));
      if (!consumed.ok || consumed.userId !== userId) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token' });
      }
      permitted = true;
    } else {
      return res.status(400).json({ success: false, message: 'Code or enrollmentToken is required' });
    }

    // Persist secret and enable 2FA
    await User.update({ twoFactorSecret: pending, twoFactorEnabled: true }, { where: { id: userId } });
    clearPendingSecret(userId);

    // Generate recovery codes
    const { plain, hashed } = generateRecoveryCodes();
    saveRecoveryCodes(userId, hashed);
    await AuditLog.create({ userId, action: 'mfa.setup.confirm', description: '2FA enabled and recovery codes generated' });

    return res.status(200).json({ success: true, message: '2FA enabled', data: { recoveryCodes: plain } });
  } catch (error) {
    logger.error('Confirm TOTP setup error', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get or regenerate recovery codes
 */
export const getRecoveryCodes = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    // For simplicity, regenerate and return fresh set
    const { plain, hashed } = generateRecoveryCodes();
    saveRecoveryCodes(userId, hashed);
    await AuditLog.create({ userId, action: 'mfa.recovery.regenerate', description: 'Recovery codes regenerated' });
    return res.status(200).json({ success: true, message: 'OK', data: { recoveryCodes: plain } });
  } catch (error) {
    logger.error('Get recovery codes error', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Disable TOTP for the authenticated user
 */
export const disableTotp = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    await User.update({ twoFactorEnabled: false, twoFactorSecret: null }, { where: { id: userId } });
    await AuditLog.create({ userId, action: 'mfa.disable', description: '2FA disabled' });
    return res.status(200).json({ success: true, message: '2FA disabled' });
  } catch (error) {
    logger.error('Disable TOTP error', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response) => {
  try {
    // User is already attached to request by auth middleware
    const userId = req.user.id;
    logger.info('Getting user profile', { userId });

    // Get user with roles
    const user = await User.findByPk(userId, {
      include: [{ association: 'roles' }]
    });

    if (!user) {
      logger.warn('User not found when getting profile', { userId });
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Fetch all assignments for this user across levels
    const [projectsDirect, subprojectsDirect, activitiesDirect] = await Promise.all([
      Project.findAll({
        attributes: ['id', 'name', 'description', 'category', 'status', 'createdAt', 'updatedAt'],
        include: [
          {
            model: User,
            as: 'members',
            attributes: [],
            through: { attributes: [] },
            where: { id: userId },
            required: true
          }
        ]
      }),
      Subproject.findAll({
        attributes: ['id', 'name', 'description', 'category', 'status', 'projectId', 'createdAt', 'updatedAt'],
        include: [
          {
            model: User,
            as: 'members',
            attributes: [],
            through: { attributes: [] },
            where: { id: userId },
            required: true
          },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name', 'description', 'category', 'status', 'createdAt', 'updatedAt']
          }
        ]
      }),
      Activity.findAll({
        attributes: ['id', 'name', 'description', 'category', 'frequency', 'status', 'subprojectId', 'createdAt', 'updatedAt'],
        include: [
          {
            model: User,
            as: 'members',
            attributes: [],
            through: { attributes: [] },
            where: { id: userId },
            required: true
          },
          {
            model: Subproject,
            as: 'subproject',
            attributes: ['id', 'name', 'description', 'category', 'status', 'projectId', 'createdAt', 'updatedAt'],
            include: [
              {
                model: Project,
                as: 'project',
                attributes: ['id', 'name', 'description', 'category', 'status', 'createdAt', 'updatedAt']
              }
            ]
          }
        ]
      })
    ]);

    // Build nested structure: projects -> subprojects -> activities
    type ProjectOut = {
      id: string;
      name: string;
      description?: string | null;
      category?: string | null;
      status: string;
      createdAt?: Date;
      updatedAt?: Date;
      subprojects: SubprojectOut[];
    };

    type SubprojectOut = {
      id: string;
      name: string;
      description?: string | null;
      category?: string | null;
      status: string;
      projectId: string;
      createdAt?: Date;
      updatedAt?: Date;
      activities: ActivityOut[];
    };

    type ActivityOut = {
      id: string;
      name: string;
      description?: string | null;
      category?: string | null;
      frequency?: string | null;
      status: string;
      subprojectId: string;
      createdAt?: Date;
      updatedAt?: Date;
    };

    const pickProject = (p: any): Omit<ProjectOut, 'subprojects'> => ({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      category: p.category ?? null,
      status: p.status,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    });

    const pickSubproject = (s: any): Omit<SubprojectOut, 'activities'> => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      category: s.category ?? null,
      status: s.status,
      projectId: s.projectId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    });

    const pickActivity = (a: any): ActivityOut => ({
      id: a.id,
      name: a.name,
      description: a.description ?? null,
      category: a.category ?? null,
      frequency: a.frequency ?? null,
      status: a.status,
      subprojectId: a.subprojectId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt
    });

    const projectMap: Map<string, ProjectOut> = new Map();

    // Seed with directly assigned projects
    for (const p of projectsDirect) {
      const pj = (p as any).toJSON();
      const proj = { ...pickProject(pj), subprojects: [] as SubprojectOut[] };
      projectMap.set(proj.id, proj);
    }

    // Add subprojects (ensure parent projects exist even if not directly assigned)
    for (const s of subprojectsDirect) {
      const sj = (s as any).toJSON();
      const parentProject = sj.project;
      const projId: string = sj.projectId || parentProject?.id;

      if (!projectMap.has(projId)) {
        // Create project container from included parent
        const base = parentProject ? pickProject(parentProject) : { id: projId, name: '', description: null, category: null, status: 'active', createdAt: undefined, updatedAt: undefined } as any;
        projectMap.set(projId, { ...base, subprojects: [] });
      }

      const container = projectMap.get(projId)!;
      const exists = container.subprojects.find((sp) => sp.id === sj.id);
      if (!exists) {
        container.subprojects.push({ ...pickSubproject(sj), activities: [] });
      }
    }

    // Add activities (ensure parent subprojects and projects exist)
    for (const a of activitiesDirect) {
      const aj = (a as any).toJSON();
      const parentSub = aj.subproject;
      const parentProj = parentSub?.project;
      const projId: string = parentSub?.projectId;
      const subId: string = aj.subprojectId;

      if (projId && !projectMap.has(projId)) {
        projectMap.set(projId, { ...pickProject(parentProj), subprojects: [] });
      }
      const projContainer = projId ? projectMap.get(projId)! : undefined;
      if (projContainer) {
        let subContainer = projContainer.subprojects.find((sp) => sp.id === subId);
        if (!subContainer) {
          // Create subproject container from included parent
          subContainer = { ...pickSubproject(parentSub), activities: [] };
          projContainer.subprojects.push(subContainer);
        }
        // Add activity if not already present
        if (!subContainer.activities.find((ac) => ac.id === aj.id)) {
          subContainer.activities.push(pickActivity(aj));
        }
      }
    }

    // Final nested projects array
    const projectsNested: ProjectOut[] = Array.from(projectMap.values());

    logger.info('Profile retrieved successfully', { userId, projectsCount: projectsNested.length });

    // Return user profile with assignments
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: user.get('roles'),
        status: user.status,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLogin: user.lastLogin,
        assignments: projectsNested
      }
    });
  } catch (error) {
    logger.error('Get profile error', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

/**
 * Change password
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    logger.info('Password change attempt', { userId });
    
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      logger.warn('Password change with missing fields', { 
        userId,
        providedFields: { currentPassword: !!currentPassword, newPassword: !!newPassword } 
      });
      return res.status(400).json({ 
        success: false,
        message: 'Current password and new password are required' 
      });
    }

    // Get user with password
    const user = await User.scope('withPassword').findByPk(userId);

    if (!user) {
      logger.warn('User not found when changing password', { userId });
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      logger.warn('Password change with incorrect current password', { userId });
      return res.status(401).json({ 
        success: false,
        message: 'Current password is incorrect' 
      });
    }

    // Update password
    logger.info('Updating user password', { userId });
    await User.update(
      { password: newPassword },
      { where: { id: userId } }
    );

    logger.info('Password changed successfully', { userId });
    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Change password error', error);
    return res.status(500).json({ 
      success: false,
      message: 'Internal server error' 
    });
  }
};

/**
 * Request password reset: generate a one-time token and email the link
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await User.findOne({ where: { email } });

    // Respond the same regardless to avoid user enumeration
    const genericOk = { success: true, message: 'If an account exists, a reset link was sent to your email.' };

    if (!user) {
      return res.status(200).json(genericOk);
    }

    // Issue a fresh token valid for 1 hour
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    await User.update({ verificationToken: token, tokenExpiry: expiry }, { where: { id: user.id } });

    const rawResetBase = `${process.env.FRONTEND_URL}/reset-password` || 'http://localhost:5173/reset-password';
    const resetBase = /^(https?:)\/\//i.test(rawResetBase) ? rawResetBase : `https://${rawResetBase}`;
    const resetLink = `${resetBase}/${token}`;

    try {
      await sendPasswordResetEmail({ email, resetLink });
    } catch (emailErr) {
      logger.error('Failed to send password reset email', emailErr);
      // Still return generic success to avoid leaking information
    }

    await AuditLog.create({ userId: user.id, action: 'auth.forgotPassword', description: 'Password reset requested' });
    return res.status(200).json(genericOk);
  } catch (error) {
    logger.error('Forgot password error', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Reset password using token
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, password, confirmPassword } = req.body || {};
    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Token, password and confirmPassword are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    const user = await User.findOne({ where: { verificationToken: token } });
    if (!user || !user.tokenExpiry || user.tokenExpiry.getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    await User.update(
      { password, verificationToken: null, tokenExpiry: null },
      { where: { id: user.id } }
    );

    await AuditLog.create({ userId: user.id, action: 'auth.resetPassword', description: 'Password reset via token' });
    return res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset password error', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  login,
  getProfile,
  changePassword,
  verifyMfa,
  startTotpSetup,
  confirmTotpSetup,
  getRecoveryCodes,
  disableTotp,
  forgotPassword,
  resetPassword
};
