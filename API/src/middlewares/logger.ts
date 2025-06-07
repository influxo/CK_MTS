import { Request, Response, NextFunction } from 'express';
import { Log } from '../models';

/**
 * Logger middleware for Express
 * Logs all requests with timestamp, method, URL, status code, and response time
 */
export const loggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Get timestamp when request starts
  const start = new Date();
  const timestamp = start.toISOString();
  
  // Store original end method to wrap it
  const originalEnd = res.end;
  
  // Create a type-safe replacement for the end method
  // @ts-ignore - We need to override the method with our custom implementation
  res.end = function(chunk?: any, encoding?: any, callback?: any): Response {
    // Calculate response time
    const responseTime = new Date().getTime() - start.getTime();
    
    // Format log entry
    const logData = {
      timestamp: new Date(timestamp),
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      responseTime: responseTime,
      ip: req.ip || req.socket.remoteAddress || '',
      userAgent: req.get('user-agent') || '',
      userId: (req as any).user?.id || 'anonymous'
    };
    
    // Log to console
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms`);
    
    // Save log to database asynchronously
    Log.create(logData)
      .catch(err => {
        console.error('Error saving log to database:', err);
      });
    
    // Handle the different function signatures
    if (typeof encoding === 'function') {
      return originalEnd.apply(this, [chunk, encoding]);
    } else if (typeof callback === 'function') {
      return originalEnd.apply(this, [chunk, encoding, callback]);
    } else {
      return originalEnd.apply(this, [chunk, encoding]);
    }
  };
  
  next();
};

export default loggerMiddleware;
