import { Request, Response } from 'express';
import { User, Role, UserRole } from '../../models';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import crypto from 'crypto';

/**
 * Get all users
 */
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.findAll({
      include: [{ association: 'roles' }]
    });

    return res.status(200).json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
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
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [{ association: 'roles' }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
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
  try {
    const { firstName, lastName, email, password, roleIds } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Create user
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
      const roles = await Role.findAll({
        where: {
          id: {
            [Op.in]: roleIds,
          },
        },
      });

      if (roles.length > 0) {
        await Promise.all(
          roles.map((role) =>
            UserRole.create({
              userId: user.id,
              roleId: role.id,
            })
          )
        );
      }
    }

    // Get user with roles
    const userWithRoles = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'roles' }],
    });

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userWithRoles,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
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
  try {
    const { id } = req.params;
    const { firstName, lastName, email, roleIds, status } = req.body;

    // Find user
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if email is being changed and if it's already in use
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
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

    await User.update(updateData, { where: { id } });

    // Update roles if provided
    if (roleIds && Array.isArray(roleIds)) {
      // Delete existing role associations
      await UserRole.destroy({ where: { userId: id } });

      // Create new role associations
      if (roleIds.length > 0) {
        const roles = await Role.findAll({
          where: { id: roleIds }
        });

        if (roles.length > 0) {
          const userRolePromises = roles.map(role => 
            UserRole.create({
              userId: id,
              roleId: role.id
            })
          );
          
          await Promise.all(userRolePromises);
        }
      }
    }

    // Fetch updated user with roles
    const updatedUser = await User.findByPk(id, {
      include: [{ association: 'roles' }]
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Delete user-role associations first
    await UserRole.destroy({ where: { userId: id } });

    // Delete user
    await User.destroy({ where: { id } });

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Reset user password (admin function)
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    // Find user
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password
    await User.update(
      { password: newPassword },
      { where: { id } }
    );

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Error resetting password:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

// Invite a new user with specified roles
export const inviteUser = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, roleIds } = req.body;
    const invitingUser = (req as any).user;

    // Validate required fields
    if (!firstName || !lastName || !email || !roleIds || !roleIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: firstName, lastName, email, and roleIds',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Generate a random password (user will reset this)
    const temporaryPassword = crypto.randomBytes(12).toString('hex');
    
    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    // Set token expiry (7 days from now)
    const tokenExpiry = new Date();
    tokenExpiry.setDate(tokenExpiry.getDate() + 7);

    // Create user with invited status
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
    const roles = await Role.findAll({
      where: {
        id: {
          [Op.in]: roleIds,
        },
      },
    });

    if (roles.length > 0) {
      await Promise.all(
        roles.map((role) =>
          UserRole.create({
            userId: user.id,
            roleId: role.id,
          })
        )
      );
    }

    // Get user with roles
    const userWithRoles = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'roles' }],
    });

    // TODO: Send invitation email with verification link
    // This would typically use an email service like SendGrid, Mailgun, etc.
    // For now, we'll just return the verification token in the response
    // In production, you would NOT return this token in the response

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
    console.error('Error inviting user:', error);
    return res.status(500).json({
      success: false,
      message: 'Error inviting user',
      error: error.message,
    });
  }
};

// Verify a user's email and activate their account
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.status(400).json({
        success: false,
        message: 'Verification token and email are required',
      });
    }

    // Find user by email and token
    const user = await User.findOne({
      where: {
        email,
        verificationToken: token,
        tokenExpiry: { [Op.gt]: new Date() }, // Token must not be expired
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    // Update user status
    await user.update({
      status: 'active',
      emailVerified: true,
      verificationToken: null,
      tokenExpiry: null,
    });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error: any) {
    console.error('Error verifying email:', error);
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
