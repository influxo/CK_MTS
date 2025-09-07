import { Request, Response } from 'express';
import { User, Role, UserRole, AuditLog, Project, Subproject, Activity, ProjectUser, SubprojectUser } from '../../models';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { createLogger } from '../../utils/logger';
import { sendInvitationEmail } from '../../utils/mailer';
import jwt from 'jsonwebtoken';

// Create a logger instance for this module
const logger = createLogger('users-controller');

/**
 * Get all users
 */
export const getAllUsers = async (req: Request, res: Response) => {
  logger.info('Getting all users');
  try {
    const users = await User.findAll({
      include: [{ association: 'roles' }]
    });

    logger.info('Successfully retrieved all users', { count: users.length });
    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    logger.error('Error fetching users', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get projects and subprojects associated to a user (nested)
 * Response: [{ project, subprojects: [...] }]
 */
export const getUserProjectsWithSubprojects = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Getting user projects with subprojects', { userId: id });

  try {
    // Ensure user exists (light check)
    const user = await User.findByPk(id);
    if (!user) {
      logger.warn('User not found when fetching projects/subprojects', { userId: id });
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const targetUserId = id;

    const [projectsDirect, subprojectsDirect, activitiesDirect] = await Promise.all([
      // Direct projects where the user is a member
      Project.findAll({
        attributes: ['id', 'name', 'description', 'category', 'status', 'createdAt', 'updatedAt'],
        include: [
          {
            model: User,
            as: 'members',
            attributes: [],
            through: { attributes: [] },
            where: { id: targetUserId },
            required: true,
          },
        ],
        order: [['name', 'ASC']],
      }),
      // Direct subprojects where the user is a member (include parent project)
      Subproject.findAll({
        attributes: ['id', 'name', 'description', 'category', 'status', 'projectId', 'createdAt', 'updatedAt'],
        include: [
          {
            model: User,
            as: 'members',
            attributes: [],
            through: { attributes: [] },
            where: { id: targetUserId },
            required: true,
          },
          {
            model: Project,
            as: 'project',
            attributes: ['id', 'name', 'description', 'category', 'status', 'createdAt', 'updatedAt'],
          },
        ],
        order: [['name', 'ASC']],
      }),
      // Direct activities where the user is a member (include parent subproject and project)
      Activity.findAll({
        attributes: ['id', 'name', 'description', 'category', 'frequency', 'status', 'subprojectId', 'createdAt', 'updatedAt'],
        include: [
          {
            model: User,
            as: 'members',
            attributes: [],
            through: { attributes: [] },
            where: { id: targetUserId },
            required: true,
          },
          {
            model: Subproject,
            as: 'subproject',
            attributes: ['id', 'name', 'description', 'category', 'status', 'projectId', 'createdAt', 'updatedAt'],
            include: [
              {
                model: Project,
                as: 'project',
                attributes: ['id', 'name', 'description', 'category', 'status', 'createdAt', 'updatedAt'],
              },
            ],
          },
        ],
      }),
    ]);

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
      updatedAt: p.updatedAt,
    });

    const pickSubproject = (s: any): Omit<SubprojectOut, 'activities'> => ({
      id: s.id,
      name: s.name,
      description: s.description ?? null,
      category: s.category ?? null,
      status: s.status,
      projectId: s.projectId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
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
      updatedAt: a.updatedAt,
    });

    const projectMap: Map<string, ProjectOut> = new Map();

    // Seed with direct projects
    for (const p of projectsDirect) {
      const pj = (p as any).toJSON();
      const proj = { ...pickProject(pj), subprojects: [] as SubprojectOut[] };
      projectMap.set(proj.id, proj);
    }

    // Add subprojects under their parent projects
    for (const s of subprojectsDirect) {
      const sj = (s as any).toJSON();
      const parentProject = sj.project;
      const projId: string = sj.projectId || parentProject?.id;

      if (!projId) continue;

      if (!projectMap.has(projId)) {
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
          subContainer = { ...pickSubproject(parentSub), activities: [] } as SubprojectOut;
          projContainer.subprojects.push(subContainer);
        }
        if (!subContainer.activities.find((ac) => ac.id === aj.id)) {
          subContainer.activities.push(pickActivity(aj));
        }
      }
    }

    const projectsNested: ProjectOut[] = Array.from(projectMap.values());

    logger.info('Successfully built nested projects/subprojects/activities for user', { userId: id, count: projectsNested.length });
    return res.status(200).json({ success: true, items: projectsNested });
  } catch (error: any) {
    logger.error('Error fetching user projects with subprojects', { userId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * Update my profile (self-service)
 * Allows only: firstName, lastName, email
 */
export const updateMyProfile = async (req: Request, res: Response) => {
  const authUser = (req as any).user;
  if (!authUser || !authUser.id) {
    logger.warn('Unauthorized profile update attempt: missing auth user');
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const userId = authUser.id;
  logger.info('Updating own profile', { userId });

  try {
    const { firstName, lastName, email } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      logger.warn('Authenticated user not found for profile update', { userId });
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // If email is changing, ensure uniqueness
    if (email && email !== user.email) {
      logger.info('Self email change requested', { userId, oldEmail: user.email, newEmail: email });
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        logger.warn('Email is already in use during self-update', { email });
        return res.status(400).json({ success: false, message: 'Email is already in use' });
      }
    }

    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;

    await user.update(updateData);

    // Reload with roles for consistent response shape
    const updatedUser = await User.findByPk(userId, { include: [{ association: 'roles' }] });

    // Audit log
    await AuditLog.create({
      userId,
      action: 'USER_PROFILE_UPDATED',
      description: 'User updated own profile information',
      details: JSON.stringify({ fields: Object.keys(updateData) }),
    });

    logger.info('Profile updated successfully', { userId });
    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error: any) {
    logger.error('Error updating profile', error);
    return res.status(500).json({ success: false, message: 'Error updating profile', error: error.message });
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Getting user by ID', { userId: id });
  
  try {
    // Load user with roles
    const user = await User.findByPk(id, {
      include: [{ association: 'roles' }]
    });

    if (!user) {
      logger.warn('User not found', { userId: id });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build nested assignments for the specified user
    const targetUserId = id;

    const [projectsDirect, subprojectsDirect, activitiesDirect] = await Promise.all([
      Project.findAll({
        attributes: ['id', 'name', 'description', 'category', 'status', 'createdAt', 'updatedAt'],
        include: [
          {
            model: User,
            as: 'members',
            attributes: [],
            through: { attributes: [] },
            where: { id: targetUserId },
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
            where: { id: targetUserId },
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
            where: { id: targetUserId },
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
          subContainer = { ...pickSubproject(parentSub), activities: [] };
          projContainer.subprojects.push(subContainer);
        }
        if (!subContainer.activities.find((ac) => ac.id === aj.id)) {
          subContainer.activities.push(pickActivity(aj));
        }
      }
    }

    const projectsNested: ProjectOut[] = Array.from(projectMap.values());

    logger.info('Successfully retrieved user with assignments', { userId: id, projectsCount: projectsNested.length });
    return res.status(200).json({
      success: true,
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles: user.get('roles'),
        status: user.status,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        assignments: projectsNested
      }
    });
  } catch (error) {
    logger.error(`Error fetching user with ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Create a new user
 */
export const createUser = async (req: Request, res: Response) => {
  logger.info('Creating new user', { email: req.body.email });
  
  try {
    const { firstName, lastName, email, password, roleIds } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      logger.warn('Missing required fields for user creation', { 
        providedFields: { firstName: !!firstName, lastName: !!lastName, email: !!email, password: !!password } 
      });
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      logger.warn('User with email already exists', { email });
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Create user
    logger.info('Creating user record', { email });
    const user = await User.create({
      id: uuidv4(),
      firstName,
      lastName,
      email,
      password,
      status: 'active',
      emailVerified: true, // Admin-created users are considered verified
    });

    // Assign roles if provided
    if (roleIds && roleIds.length > 0) {
      logger.info('Assigning roles to user', { userId: user.id, roleIds });
      let roles: Role[] = [];
      
      try {
        // First try to find roles directly by ID (in case they're valid UUIDs)
        roles = await Role.findAll({
          where: {
            id: {
              [Op.in]: roleIds.map((id: string | number) => String(id))
            }
          }
        });
        
        // If no roles found, try to find by index position
        if (roles.length === 0) {
          logger.info('No roles found by direct ID, trying to find by index', { roleIds });
          
          // Get all roles ordered by creation date
          const allRoles = await Role.findAll({
            order: [['createdAt', 'ASC']]
          });
          
          // Map numeric IDs to actual role objects
          roles = roleIds
            .map((id: string | number) => {
              const index = typeof id === 'number' ? id - 1 : parseInt(String(id)) - 1;
              return index >= 0 && index < allRoles.length ? allRoles[index] : null;
            })
            .filter((role: Role | null): role is Role => role !== null);
            
          logger.info('Found roles by index position', { 
            roleCount: roles.length,
            roleNames: roles.map((r: Role) => r.name)
          });
        }
      } catch (error) {
        logger.error('Error finding roles', error);
        roles = [];
      }

      if (roles.length > 0) {
        await Promise.all(
          roles.map((role: Role) => 
            UserRole.create({
              userId: user.id,
              roleId: role.id
            })
          )
        );
        logger.info('Roles assigned successfully', { userId: user.id, roleCount: roles.length });
      } else {
        logger.warn('No valid roles found to assign', { roleIds });
      }
    }

    // Get user with roles
    const userWithRoles = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'roles' }]
    });

    logger.info('User created successfully', { userId: user.id });
    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userWithRoles,
    });
  } catch (error: any) {
    logger.error('Error creating user', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message,
    });
  }
};

/**
 * Update an existing user
 */
export const updateUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Updating user', { userId: id });
  
  try {
    const { firstName, lastName, email, roleIds, status } = req.body;

    // Find user
    const user = await User.findByPk(id);
    if (!user) {
      logger.warn('User not found for update', { userId: id });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is being changed and if it's already in use
    if (email && email !== user.email) {
      logger.info('Email change requested', { userId: id, oldEmail: user.email, newEmail: email });
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        logger.warn('Email is already in use', { email });
        return res.status(400).json({
          success: false,
          message: 'Email is already in use'
        });
      }
    }

    // Update user
    const updateData: any = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (email) updateData.email = email;
    if (status) updateData.status = status;

    logger.info('Updating user data', { userId: id, fields: Object.keys(updateData) });
    await user.update(updateData);

    // Update roles if provided
    if (roleIds && Array.isArray(roleIds)) {
      logger.info('Updating user roles', { userId: id, roleIds });
      
      // Remove existing roles
      await UserRole.destroy({
        where: {
          userId: id
        }
      });

      // Since roleIds from frontend might be numeric but our DB uses UUIDs,
      // we need to query roles differently
      let roles: Role[] = [];
      
      try {
        // First try to find roles directly by ID (in case they're valid UUIDs)
        roles = await Role.findAll({
          where: {
            id: {
              [Op.in]: roleIds.map((id: string | number) => String(id))
            }
          }
        });
        
        // If no roles found, try to find by index position
        if (roles.length === 0) {
          logger.info('No roles found by direct ID, trying to find by index', { roleIds });
          
          // Get all roles ordered by creation date
          const allRoles = await Role.findAll({
            order: [['createdAt', 'ASC']]
          });
          
          // Map numeric IDs to actual role objects
          roles = roleIds
            .map((id: string | number) => {
              const index = typeof id === 'number' ? id - 1 : parseInt(String(id)) - 1;
              return index >= 0 && index < allRoles.length ? allRoles[index] : null;
            })
            .filter((role: Role | null): role is Role => role !== null);
            
          logger.info('Found roles by index position', { 
            roleCount: roles.length,
            roleNames: roles.map((r: Role) => r.name)
          });
        }
      } catch (error) {
        logger.error('Error finding roles', error);
        roles = [];
      }

      if (roles.length > 0) {
        await Promise.all(
          roles.map((role: Role) => 
            UserRole.create({
              userId: id,
              roleId: role.id
            })
          )
        );
        logger.info('Roles updated successfully', { userId: id, roleCount: roles.length });
      } else {
        logger.warn('No valid roles found to assign', { roleIds });
      }
    }

    // Get updated user with roles
    const updatedUser = await User.findByPk(id, {
      include: [{ model: Role, as: 'roles' }]
    });

    logger.info('User updated successfully', { userId: id });
    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error: any) {
    logger.error(`Error updating user with ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: 'Error updating user',
      error: error.message
    });
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Deleting user', { userId: id });
  
  try {
    const user = await User.findByPk(id);
    
    if (!user) {
      logger.warn('User not found for deletion', { userId: id });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete user roles first
    logger.info('Deleting user roles', { userId: id });
    await UserRole.destroy({
      where: {
        userId: id
      }
    });

    // Delete user
    logger.info('Deleting user record', { userId: id });
    await user.destroy();

    logger.info('User deleted successfully', { userId: id });
    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    logger.error(`Error deleting user with ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: 'Error deleting user',
      error: error.message
    });
  }
};

/**
 * Reset user password (admin function)
 */
export const resetPassword = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Resetting user password', { userId: id });
  
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      logger.warn('New password not provided for reset', { userId: id });
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    const user = await User.findByPk(id);
    
    if (!user) {
      logger.warn('User not found for password reset', { userId: id });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    logger.info('Updating user password', { userId: id });
    await user.update({
      password: hashedPassword
    });

    logger.info('Password reset successful', { userId: id });
    return res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error: any) {
    logger.error(`Error resetting password for user with ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

/**
 * Invite a new user with specified roles
 */
export const inviteUser = async (req: Request, res: Response) => {
  logger.info('Inviting new user', { email: req.body.email });
  
  try {
    const { firstName, lastName, email, roleIds, message, projectId, subprojectId } = req.body;
    const invitingUser = (req as any).user;
    logger.info('Invitation initiated by', { invitingUserId: invitingUser.id });

    // Validate required fields
    if (!firstName || !lastName || !email || !roleIds || !roleIds.length) {
      logger.warn('Missing required fields for user invitation', { 
        providedFields: { firstName: !!firstName, lastName: !!lastName, email: !!email, roleIds: !!roleIds && roleIds.length > 0 } 
      });
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: firstName, lastName, email, and roleIds',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      logger.warn('User with email already exists', { email });
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Generate a random password (user will reset this)
    logger.info('Generating temporary credentials', { email });
    const temporaryPassword = crypto.randomBytes(12).toString('hex');
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Set token expiry (7 days from now)
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 7);
    logger.info('Token expiry set', { email, expiryDate: tokenExpiry });

    // Validate provided association targets if any
    let targetProject: Project | null = null;
    let targetSubproject: Subproject | null = null;
    if (projectId && subprojectId) {
      logger.warn('Both projectId and subprojectId provided; prioritizing subproject association', { projectId, subprojectId });
    }
    if (subprojectId) {
      targetSubproject = await Subproject.findByPk(subprojectId);
      if (!targetSubproject) {
        return res.status(404).json({ success: false, message: 'Subproject not found' });
      }
    } else if (projectId) {
      targetProject = await Project.findByPk(projectId);
      if (!targetProject) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
    }

    // Create user with invited status
    logger.info('Creating invited user', { email });
    const user = await User.create({
      id: uuidv4(),
      firstName,
      lastName,
      email,
      password: temporaryPassword, // This will be hashed by the User model
      status: 'invited',
      emailVerified: false,
      verificationToken,
      tokenExpiry,
      invitedBy: invitingUser.id
    });

    // Assign roles
    logger.info('Assigning roles to invited user', { userId: user.id, roleIds });
    
    let roles: Role[] = [];
    
    try {
      // First try to find roles directly by ID (in case they're valid UUIDs)
      roles = await Role.findAll({
        where: {
          id: {
            [Op.in]: roleIds.map((id: string | number) => String(id))
          }
        }
      });
      
      // If no roles found, try to find by index position
      if (roles.length === 0) {
        logger.info('No roles found by direct ID, trying to find by index', { roleIds });
        
        // Get all roles ordered by creation date
        const allRoles = await Role.findAll({
          order: [['createdAt', 'ASC']]
        });
        
        // Map numeric IDs to actual role objects
        roles = roleIds
          .map((id: string | number) => {
            const index = typeof id === 'number' ? id - 1 : parseInt(String(id)) - 1;
            return index >= 0 && index < allRoles.length ? allRoles[index] : null;
          })
          .filter((role: Role | null): role is Role => role !== null);
          
        logger.info('Found roles by index position', { 
          roleCount: roles.length,
          roleNames: roles.map((r: Role) => r.name)
        });
      }
    } catch (error) {
      logger.error('Error finding roles', error);
      roles = [];
    }

    if (roles.length > 0) {
      await Promise.all(
        roles.map((role: Role) =>
          UserRole.create({
            userId: user.id,
            roleId: role.id,
          })
        )
      );
      logger.info('Roles assigned successfully', { userId: user.id, roleCount: roles.length });
    } else {
      logger.warn('No valid roles found to assign', { roleIds });
    }

    // Automatically associate user with project/subproject if provided
    if (targetSubproject) {
      try {
        await SubprojectUser.create({ id: uuidv4(), userId: user.id, subprojectId: targetSubproject.id });
        await AuditLog.create({
          userId: invitingUser.id,
          action: 'USER_ASSIGNED_TO_SUBPROJECT',
          description: `Invited user assigned to subproject '${targetSubproject.name}'`,
          details: JSON.stringify({ userId: user.id, subprojectId: targetSubproject.id }),
        });
      } catch (assignErr: any) {
        logger.error('Failed assigning user to subproject during invitation', { error: assignErr?.message });
      }
    } else if (targetProject) {
      try {
        await ProjectUser.create({ id: uuidv4(), userId: user.id, projectId: targetProject.id });
        await AuditLog.create({
          userId: invitingUser.id,
          action: 'USER_ASSIGNED_TO_PROJECT',
          description: `Invited user assigned to project '${targetProject.name}'`,
          details: JSON.stringify({ userId: user.id, projectId: targetProject.id }),
        });
      } catch (assignErr: any) {
        logger.error('Failed assigning user to project during invitation', { error: assignErr?.message });
      }
    }

    // Get user with roles
    const userWithRoles = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'roles' }],
    });

    // Prepare accept-invitation link once so it can be returned in response
    const rawAcceptBase = `${process.env.FRONTEND_URL}/accept-invitation` || 'http://localhost:5173/accept-invitation';
    const acceptBase = /^(https?:)\/\//i.test(rawAcceptBase) ? rawAcceptBase : `https://${rawAcceptBase}`;
    const acceptInvitationLink = `${acceptBase}?token=${verificationToken}&email=${encodeURIComponent(email)}`;

    // TODO: Send invitation email with verification link
    logger.info('User invited successfully, email should be sent', { userId: user.id });
    
    try {
      // Calculate expiration date for display in email
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);
      const formattedExpiration = expirationDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      // Send invitation email
      await sendInvitationEmail({
        firstName,
        lastName,
        email,
        expiration: formattedExpiration,
        inviteLink: acceptInvitationLink,
        message,
      });
      
      logger.info('Invitation email sent successfully', { email });
    } catch (emailError) {
      logger.error('Failed to send invitation email', emailError);
      // We don't want to fail the whole invitation process if just the email fails
      // The user is still created in the database
    }

    return res.status(201).json({
      success: true,
      message: 'User invited successfully',
      data: {
        user: userWithRoles,
        verificationToken, // In production, remove this from the response
        acceptInvitationLink,
        projectAssignment: targetProject ? { projectId: targetProject.id, name: targetProject.name } : undefined,
        subprojectAssignment: targetSubproject ? { subprojectId: targetSubproject.id, name: targetSubproject.name } : undefined,
      },
    });
  } catch (error: any) {
    logger.error('Error inviting user', error);
    return res.status(500).json({
      success: false,
      message: 'Error inviting user',
      error: error.message,
    });
  }
};

/**
 * Verify a user's email and activate their account
 */
export const verifyEmail = async (req: Request, res: Response) => {
  const { token, email } = req.query;
  logger.info('Verifying email', { email });
  
  try {
    if (!token || !email) {
      logger.warn('Missing verification token or email', { token: !!token, email: !!email });
      return res.status(400).json({
        success: false,
        message: 'Verification token and email are required',
      });
    }

    // Find user by email and token
    logger.info('Finding user by email and token', { email });
    const user = await User.findOne({
      where: {
        email,
        verificationToken: token,
        tokenExpiry: { [Op.gt]: new Date() }, // Token must not be expired
      },
    });

    if (!user) {
      logger.warn('Invalid or expired verification token', { email });
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    // Mark email as verified but keep token for accept step
    logger.info('Marking email as verified; awaiting accept-invitation to activate account', { userId: user.id });
    await user.update({
      emailVerified: true,
    });

    // Audit log
    await AuditLog.create({
      userId: user.id,
      action: 'USER_EMAIL_VERIFIED',
      description: `User email verified`,
      details: JSON.stringify({ email: user.email }),
    });

    // If a frontend accept invitation URL is configured, redirect user there with token and email
    const acceptUrl = process.env.FRONTEND_ACCEPT_INVITE_URL;
    if (acceptUrl && typeof acceptUrl === 'string') {
      const redirectTo = `${acceptUrl}?token=${encodeURIComponent(String(token))}&email=${encodeURIComponent(String(email))}`;
      logger.info('Email verified successfully; redirecting to accept invitation UI', { userId: user.id, redirectTo });
      return res.redirect(302, redirectTo);
    }

    logger.info('Email verified successfully (token retained for acceptance), no FRONTEND_URL configured', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'Email verified. Please set your password to activate your account.',
    });
  } catch (error: any) {
    logger.error('Error verifying email', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying email',
      error: error.message,
    });
  }
};

/**
 * Accept an invitation: set password and activate account
 */
export const acceptInvitation = async (req: Request, res: Response) => {
  logger.info('Accept invitation attempt');
  try {
    const { token, email, password } = req.body;

    // Validate input
    if (!token || !email || !password) {
      logger.warn('Missing fields for accepting invitation', { token: !!token, email: !!email, hasPassword: !!password });
      return res.status(400).json({
        success: false,
        message: 'Token, email and password are required',
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      logger.warn('Password does not meet complexity requirements');
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long',
      });
    }

    // Find user by email and token and ensure token not expired
    const user = await User.scope('withPassword').findOne({
      where: {
        email,
        verificationToken: token,
        tokenExpiry: { [Op.gt]: new Date() },
      },
      include: [{ association: 'roles' }],
    });

    if (!user) {
      logger.warn('Invalid or expired token during accept-invitation', { email });
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    // Update password and activate account
    logger.info('Activating user and setting password', { userId: user.id });
    await user.update({
      password, // will be hashed by model setter
      status: 'active',
      emailVerified: true,
      verificationToken: null,
      tokenExpiry: null,
    });

    // Audit log
    await AuditLog.create({
      userId: user.id,
      action: 'USER_INVITATION_ACCEPTED',
      description: `User accepted invitation and activated account`,
      details: JSON.stringify({ email: user.email }),
    });

    // Issue JWT for immediate login
    const jwtSecret = process.env.JWT_SECRET || 'default_secret_change_me';
    const tokenJwt = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: '24h' });

    // Reload user without password
    const activatedUser = await User.findByPk(user.id, { include: [{ association: 'roles' }] });

    logger.info('Invitation accepted successfully', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'Account activated successfully',
      data: {
        token: tokenJwt,
        user: activatedUser,
      },
    });
  } catch (error: any) {
    logger.error('Error accepting invitation', error);
    return res.status(500).json({
      success: false,
      message: 'Error accepting invitation',
      error: error.message,
    });
  }
};

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  updateMyProfile,
  deleteUser,
  resetPassword,
  inviteUser,
  verifyEmail,
  acceptInvitation,
  getUserProjectsWithSubprojects,
};
