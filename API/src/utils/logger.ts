import { Log } from '../models';

/**
 * Log levels enum
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

/**
 * Logger interface
 */
interface LoggerOptions {
  module: string;
  saveToDb?: boolean;
  userId?: string;
}

/**
 * Logger utility for application-wide logging
 * Provides detailed function-level logging with different log levels
 */
export const logger = (options: LoggerOptions) => {
  const { module, saveToDb = false, userId = 'system' } = options;
  
  /**
   * Format log message with timestamp, module name and log level
   */
  const formatMessage = (level: LogLevel, message: string, data?: any): string => {
    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${level}] [${module}] ${message}`;
    
    if (data) {
      if (typeof data === 'object') {
        try {
          // Safely stringify objects, handling circular references
          const seen = new Set();
          const safeData = JSON.stringify(data, (key, value) => {
            if (key === 'password' || key === 'token') return '[REDACTED]';
            if (typeof value === 'object' && value !== null) {
              if (seen.has(value)) return '[Circular]';
              seen.add(value);
            }
            return value;
          }, 2);
          formattedMessage += `\nData: ${safeData}`;
        } catch (err) {
          formattedMessage += `\nData: [Unable to stringify data]`;
        }
      } else {
        formattedMessage += `\nData: ${data}`;
      }
    }
    
    return formattedMessage;
  };
  
  /**
   * Save log to database if saveToDb is true
   */
  const saveLog = async (level: LogLevel, message: string, data?: any) => {
    if (!saveToDb) return;
    
    try {
      await Log.create({
        timestamp: new Date(),
        level,
        module,
        message,
        data: data ? JSON.stringify(data) : null,
        userId
      });
    } catch (err) {
      console.error('Error saving log to database:', err);
    }
  };
  
  return {
    debug: (message: string, data?: any) => {
      const seen = new Set();
      const formattedMessage = formatMessage(LogLevel.DEBUG, message, data);
      console.debug(formattedMessage);
      saveLog(LogLevel.DEBUG, message, data);
    },
    
    info: (message: string, data?: any) => {
      const seen = new Set();
      const formattedMessage = formatMessage(LogLevel.INFO, message, data);
      console.info(formattedMessage);
      saveLog(LogLevel.INFO, message, data);
    },
    
    warn: (message: string, data?: any) => {
      const seen = new Set();
      const formattedMessage = formatMessage(LogLevel.WARN, message, data);
      console.warn(formattedMessage);
      saveLog(LogLevel.WARN, message, data);
    },
    
    error: (message: string, error?: Error | any) => {
      const seen = new Set();
      let data = error;
      
      // Extract stack trace and other details if it's an Error object
      if (error instanceof Error) {
        data = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          ...(error as any) // Include any additional properties
        };
      }
      
      const formattedMessage = formatMessage(LogLevel.ERROR, message, data);
      console.error(formattedMessage);
      saveLog(LogLevel.ERROR, message, data);
    },
    
    /**
     * Function decorator for logging function entry and exit
     * @param name Optional function name override
     */
    trackFunction: (name?: string) => {
      return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        const originalMethod = descriptor.value;
        const functionName = name || propertyKey;
        
        descriptor.value = async function(...args: any[]) {
          const seen = new Set();
          const formattedArgs = args.map(arg => {
            if (typeof arg === 'object' && arg !== null) {
              try {
                return JSON.stringify(arg, (key, value) => {
                  if (key === 'password' || key === 'token') return '[REDACTED]';
                  return value;
                });
              } catch (e) {
                return '[Complex Object]';
              }
            }
            return arg;
          }).join(', ');
          
          const startMessage = `Function ${functionName} started with args: ${formattedArgs}`;
          console.info(formatMessage(LogLevel.INFO, startMessage));
          
          try {
            const result = await originalMethod.apply(this, args);
            
            let resultStr = '[No return value]';
            if (result !== undefined) {
              try {
                resultStr = typeof result === 'object' ? 
                  JSON.stringify(result, (key, value) => {
                    if (key === 'password' || key === 'token') return '[REDACTED]';
                    return value;
                  }) : 
                  String(result);
              } catch (e) {
                resultStr = '[Complex Object]';
              }
            }
            
            const endMessage = `Function ${functionName} completed successfully`;
            console.info(formatMessage(LogLevel.INFO, endMessage, { result: resultStr }));
            
            return result;
          } catch (error) {
            const errorMessage = `Function ${functionName} failed`;
            console.error(formatMessage(LogLevel.ERROR, errorMessage, error));
            throw error;
          }
        };
        
        return descriptor;
      };
    }
  };
};

/**
 * Create a default logger instance
 */
export const defaultLogger = logger({ module: 'app' });

/**
 * Export a simple function to create loggers with less boilerplate
 */
export const createLogger = (module: string, options: Partial<Omit<LoggerOptions, 'module'>> = {}) => {
  return logger({
    module,
    ...options
  });
};
