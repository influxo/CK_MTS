import { Request, Response } from 'express';

/**
 * Health check controller
 * Returns basic information about the API status
 * 
 * @param req - Express request object
 * @param res - Express response object
 */
export const healthController = (req: Request, res: Response): void => {
  const healthInfo = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };
  
  res.status(200).json(healthInfo);
};

export default {
  healthController
};
