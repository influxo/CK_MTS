import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, Role } from '../../models';
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

    logger.info('Profile retrieved successfully', { userId });
    // Return user profile
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
        lastLogin: user.lastLogin
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
