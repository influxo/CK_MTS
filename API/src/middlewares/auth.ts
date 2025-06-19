import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, Role, Permission } from '../models';

// Define interfaces for User with roles and permissions
interface UserWithRoles extends User {
  roles?: Array<RoleWithPermissions>;
}

interface RoleWithPermissions extends Role {
  permissions?: Array<Permission>;
}

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
      userRoles?: any[];
      userPermissions?: any[];
    }
  }
}

/**
 * Authentication middleware using JWT
 * Verifies the token and attaches user to request object
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Authentication required. No token provided.' });
      return;
    }
    
    // Extract token
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      res.status(401).json({ message: 'Authentication required. Invalid token format.' });
      return;
    }
    
    // Verify token
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_change_me');
    
    // Find user
    const user = await User.findByPk(decoded.id);
    
    if (!user) {
      res.status(401).json({ message: 'User not found or token invalid.' });
      return;
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      res.status(403).json({ message: 'User account is not active.' });
      return;
    }
    
    // Attach user to request
    req.user = user;
    
    // Continue to next middleware
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: 'Invalid token.' });
      return;
    } else if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: 'Token expired.' });
      return;
    }
    
    console.error('Authentication error:', error);
    res.status(500).json({ message: 'Internal server error during authentication.' });
    return;
  }
};

/**
 * Authorization middleware for role-based access control
 * @param requiredRoles - Array of role names required to access the resource
 */
export const authorize = (requiredRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Make sure user is authenticated first
      if (!req.user) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
      }
      
      
      // Get user roles
      const userWithRoles = await User.findByPk(req.user.id, {
        include: [
          {
            association: 'roles',
            include: [{ association: 'permissions' }]
          }
        ]
      }) as unknown as UserWithRoles;
      
      if (!userWithRoles) {
        res.status(401).json({ message: 'User not found.' });
        return;
      }
      
      // Extract roles and permissions
      const userRoles = userWithRoles.roles || [];
      req.userRoles = userRoles;
      
      // Collect all permissions from all roles
      const userPermissions: any[] = [];
      userRoles.forEach((role: any) => {
        if (role.permissions) {
          role.permissions.forEach((permission: any) => {
            userPermissions.push(permission);
          });
        }
      });
      req.userPermissions = userPermissions;
      
      // Check if user has any of the required roles
      const hasRequiredRole = requiredRoles.length === 0 || 
        userRoles.some((role: any) => requiredRoles.includes(role.name));
      
      if (!hasRequiredRole) {
        res.status(403).json({ 
          message: 'Access denied. Insufficient permissions.' 
        });
        return;
      }
      
      // User has required role, proceed
      next();
    } catch (error) {
      console.error('Authorization error:', error);
      res.status(500).json({ message: 'Internal server error during authorization.' });
      return;
    }
  };
};

/**
 * Permission-based authorization middleware
 * @param resource - The resource being accessed
 * @param action - The action being performed (create, read, update, delete)
 */
export const hasPermission = (resource: string, action: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Make sure user is authenticated first
      if (!req.user) {
        res.status(401).json({ message: 'Authentication required.' });
        return;
      }
      
      // If user permissions are not loaded yet, load them
      if (!req.userPermissions) {
        const userWithRoles = await User.findByPk(req.user.id, {
          include: [
            {
              association: 'roles',
              include: [{ association: 'permissions' }]
            }
          ]
        }) as unknown as UserWithRoles;
        
        if (!userWithRoles) {
          res.status(401).json({ message: 'User not found.' });
          return;
        }
        
        // Extract roles and permissions
        const userRoles = userWithRoles.roles || [];
        req.userRoles = userRoles;
        
        // Collect all permissions from all roles
        const userPermissions: any[] = [];
        userRoles.forEach((role: any) => {
          if (role.permissions) {
            role.permissions.forEach((permission: any) => {
              userPermissions.push(permission);
            });
          }
        });
        req.userPermissions = userPermissions;
      }
      
      // Check if user has the required permission
      const hasRequiredPermission = req.userPermissions.some(
        (permission: any) => 
          permission.resource === resource && 
          permission.action === action
      );
      
      if (!hasRequiredPermission) {
        res.status(403).json({ 
          message: `Access denied. You don't have permission to ${action} ${resource}.` 
        });
        return;
      }
      
      // User has required permission, proceed
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Internal server error during permission check.' });
      return;
    }
  };
};

export default {
  authenticate,
  authorize,
  hasPermission
};
