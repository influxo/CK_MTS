import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Swagger definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Caritas Kosova and Mother Teresa Society API',
    version: '1.0.0',
    description: 'API documentation for the Caritas Kosova and Mother Teresa Society platform',
    license: {
      name: 'Private',
    },
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
  },
  servers: [
    {
      url: '/api',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'User ID',
          },
          firstName: {
            type: 'string',
            description: 'User first name',
          },
          lastName: {
            type: 'string',
            description: 'User last name',
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address',
          },
          status: {
            type: 'string',
            enum: ['active', 'inactive', 'invited'],
            description: 'User status',
          },
          emailVerified: {
            type: 'boolean',
            description: 'Whether the user email is verified',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Creation timestamp',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last update timestamp',
          },
          roles: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Role',
            },
          },
        },
      },
      Role: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Role ID',
          },
          name: {
            type: 'string',
            description: 'Role name',
          },
          description: {
            type: 'string',
            description: 'Role description',
          },
          permissions: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Permission',
            },
          },
        },
      },
      Permission: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description: 'Permission ID',
          },
          resource: {
            type: 'string',
            description: 'Resource name',
          },
          action: {
            type: 'string',
            description: 'Action name (create, read, update, delete)',
          },
          description: {
            type: 'string',
            description: 'Permission description',
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
          },
          error: {
            type: 'string',
          },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication is required',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              message: 'Authentication required',
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Access denied due to insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              message: 'Access denied. Insufficient permissions.',
            },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              message: 'Resource not found',
            },
          },
        },
      },
      ServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              success: false,
              message: 'Internal server error',
            },
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

// Options for the swagger docs
const options = {
  swaggerDefinition,
  // Path to the API docs
  apis: ['./src/routes/*.ts', './src/controllers/**/*.ts'],
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(options);

export { swaggerUi, swaggerSpec };
