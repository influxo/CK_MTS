import { Request, Response } from 'express';
import { User, Role, UserRole } from '../../models';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { createLogger } from '../../utils/logger';
import { sendInvitationEmail } from '../../utils/mailer';

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
 * Get user by ID
 */
export const getUserById = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Getting user by ID', { userId: id });
  
  try {
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

    logger.info('Successfully retrieved user', { userId: id });
    return res.status(200).json({
      success: true,
      data: user
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
    const { firstName, lastName, email, roleIds, message } = req.body;
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

    // Get user with roles
    const userWithRoles = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'roles' }],
    });

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
      
      // Generate verification link
      const verificationLink = `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
      
      // Send invitation email
      await sendInvitationEmail({
        firstName,
        lastName,
        email,
        expiration: formattedExpiration,
        inviteLink: verificationLink,
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
        verificationLink: `${req.protocol}://${req.get('host')}/api/auth/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`
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

    // Update user status
    logger.info('Updating user status to active', { userId: user.id });
    await user.update({
      status: 'active',
      emailVerified: true,
      verificationToken: null,
      tokenExpiry: null,
    });

    logger.info('Email verified successfully', { userId: user.id });
    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
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

export default {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  inviteUser,
  verifyEmail,
};
