import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, Role, Project, Subproject, Activity } from '../../models';
import { createLogger } from '../../utils/logger';

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

    // Generate JWT token
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

export default {
  login,
  getProfile,
  changePassword
};
